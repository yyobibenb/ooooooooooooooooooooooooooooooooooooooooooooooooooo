import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import type { AgentAction } from "./model-router";

const execAsync = promisify(exec);

const PROJECT_ROOT = process.cwd();
const ALLOWED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html", ".md", ".txt", ".sql"];
const BLOCKED_PATHS = ["node_modules", ".git", ".env", "secrets"];
const MAX_DELETE_LINES = 50;

function isPathSafe(filePath: string): boolean {
  const normalized = path.normalize(filePath);
  const resolved = path.resolve(PROJECT_ROOT, normalized);
  
  if (!resolved.startsWith(PROJECT_ROOT)) {
    return false;
  }
  
  for (const blocked of BLOCKED_PATHS) {
    if (normalized.includes(blocked)) {
      return false;
    }
  }
  
  return true;
}

function isCommandSafe(command: string): boolean {
  const blockedCommands = [
    "rm -rf",
    "rm -r",
    "sudo",
    "chmod",
    "chown",
    "mv /",
    "cp /",
    "> /",
    "curl | bash",
    "wget | bash",
    "eval",
    "exec",
    "DROP TABLE",
    "DROP DATABASE",
    "DELETE FROM",
    "TRUNCATE"
  ];
  
  const lowerCmd = command.toLowerCase();
  return !blockedCommands.some(blocked => lowerCmd.includes(blocked.toLowerCase()));
}

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

export async function executeAction(action: AgentAction): Promise<ToolResult> {
  try {
    switch (action.type) {
      case "read_file":
        return await readFile(action.path!);
      
      case "write_to_file":
      case "create_file":
        return await writeFile(action.path!, action.content!);
      
      case "apply_diff":
        return await applyDiff(action.path!, action.search!, action.replace!);
      
      case "run_command":
        return await runCommand(action.command!);
      
      case "list_files":
        return await listFiles(action.path || ".");
      
      case "search_code":
        return await searchCode(action.query!);
      
      case "message":
        return { success: true, output: action.content };
      
      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

async function readFile(filePath: string): Promise<ToolResult> {
  if (!isPathSafe(filePath)) {
    return { success: false, error: "Access denied: path not allowed" };
  }
  
  const fullPath = path.resolve(PROJECT_ROOT, filePath);
  
  try {
    const content = await fs.readFile(fullPath, "utf-8");
    return { success: true, output: content };
  } catch (error) {
    return { success: false, error: `File not found: ${filePath}` };
  }
}

async function writeFile(filePath: string, content: string): Promise<ToolResult> {
  if (!isPathSafe(filePath)) {
    return { success: false, error: "Access denied: path not allowed" };
  }
  
  const ext = path.extname(filePath);
  if (ext && !ALLOWED_EXTENSIONS.includes(ext)) {
    return { success: false, error: `File type not allowed: ${ext}` };
  }
  
  const fullPath = path.resolve(PROJECT_ROOT, filePath);
  const dir = path.dirname(fullPath);
  
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
    return { success: true, output: `File written: ${filePath}` };
  } catch (error) {
    return { success: false, error: `Failed to write file: ${filePath}` };
  }
}

async function applyDiff(filePath: string, search: string, replace: string): Promise<ToolResult> {
  if (!isPathSafe(filePath)) {
    return { success: false, error: "Access denied: path not allowed" };
  }
  
  const fullPath = path.resolve(PROJECT_ROOT, filePath);
  
  try {
    const content = await fs.readFile(fullPath, "utf-8");
    
    if (!content.includes(search)) {
      return { success: false, error: "Search string not found in file" };
    }
    
    const searchLines = search.split("\n").length;
    const replaceLines = replace.split("\n").length;
    const deletedLines = searchLines - replaceLines;
    
    if (deletedLines > MAX_DELETE_LINES) {
      return { 
        success: false, 
        error: `Cannot delete more than ${MAX_DELETE_LINES} lines at once (trying to delete ${deletedLines})` 
      };
    }
    
    const newContent = content.replace(search, replace);
    await fs.writeFile(fullPath, newContent, "utf-8");
    
    return { success: true, output: `Diff applied to: ${filePath}` };
  } catch (error) {
    return { success: false, error: `Failed to apply diff: ${filePath}` };
  }
}

async function runCommand(command: string): Promise<ToolResult> {
  if (!isCommandSafe(command)) {
    return { success: false, error: "Command blocked for security reasons" };
  }
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: PROJECT_ROOT,
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
    
    return { 
      success: true, 
      output: stdout + (stderr ? `\nSTDERR: ${stderr}` : "") 
    };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.stderr || error.message || "Command failed" 
    };
  }
}

async function listFiles(dirPath: string): Promise<ToolResult> {
  if (!isPathSafe(dirPath)) {
    return { success: false, error: "Access denied: path not allowed" };
  }
  
  const fullPath = path.resolve(PROJECT_ROOT, dirPath);
  const files: string[] = [];
  
  const walk = async (dir: string, prefix: string = ""): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (BLOCKED_PATHS.some(b => entry.name.includes(b))) continue;
      
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        files.push(`${relativePath}/`);
        if (files.length < 200) {
          await walk(path.join(dir, entry.name), relativePath);
        }
      } else {
        files.push(relativePath);
      }
      
      if (files.length >= 200) break;
    }
  };
  
  try {
    await walk(fullPath);
    return { success: true, output: files.join("\n") };
  } catch (error) {
    return { success: false, error: `Failed to list directory: ${dirPath}` };
  }
}

async function searchCode(query: string): Promise<ToolResult> {
  try {
    const { stdout } = await execAsync(
      `grep -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" -n "${query}" . | head -50`,
      { cwd: PROJECT_ROOT, timeout: 10000 }
    );
    
    return { success: true, output: stdout || "No matches found" };
  } catch (error: any) {
    if (error.code === 1) {
      return { success: true, output: "No matches found" };
    }
    return { success: false, error: "Search failed" };
  }
}

export async function executeActions(actions: AgentAction[]): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  
  for (const action of actions) {
    const result = await executeAction(action);
    results.push(result);
    
    if (!result.success && action.type !== "message") {
      break;
    }
  }
  
  return results;
}
