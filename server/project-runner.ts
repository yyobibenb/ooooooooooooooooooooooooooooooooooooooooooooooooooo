import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs/promises";

const WORKSPACE_ROOT = path.join(process.cwd(), "workspace");

interface RunningProcess {
  process: ChildProcess;
  projectId: number;
  port?: number;
  startTime: Date;
}

const runningProcesses = new Map<number, RunningProcess>();

export function getProjectWorkspace(projectId: number): string {
  return path.join(WORKSPACE_ROOT, `project_${projectId}`);
}

async function detectProjectType(projectRoot: string): Promise<{ type: string; command: string; args: string[] }> {
  try {
    const packageJsonPath = path.join(projectRoot, "package.json");
    const packageJsonExists = await fs.access(packageJsonPath).then(() => true).catch(() => false);
    
    if (packageJsonExists) {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
      const scripts = packageJson.scripts || {};
      
      if (scripts.dev) {
        return { type: "nodejs", command: "npm", args: ["run", "dev"] };
      } else if (scripts.start) {
        return { type: "nodejs", command: "npm", args: ["run", "start"] };
      }
      return { type: "nodejs", command: "node", args: ["index.js"] };
    }
    
    const requirementsTxt = path.join(projectRoot, "requirements.txt");
    const requirementsExists = await fs.access(requirementsTxt).then(() => true).catch(() => false);
    
    if (requirementsExists) {
      const mainPy = await fs.access(path.join(projectRoot, "main.py")).then(() => true).catch(() => false);
      const appPy = await fs.access(path.join(projectRoot, "app.py")).then(() => true).catch(() => false);
      
      if (mainPy) {
        return { type: "python", command: "python", args: ["main.py"] };
      } else if (appPy) {
        return { type: "python", command: "python", args: ["app.py"] };
      }
    }
    
    const indexHtml = path.join(projectRoot, "index.html");
    const indexHtmlExists = await fs.access(indexHtml).then(() => true).catch(() => false);
    
    if (indexHtmlExists) {
      return { type: "static", command: "npx", args: ["serve", "-l", "3000"] };
    }
    
    return { type: "unknown", command: "echo", args: ["No runnable project detected"] };
  } catch (err) {
    return { type: "unknown", command: "echo", args: ["Error detecting project type"] };
  }
}

export async function startProject(
  projectId: number,
  onOutput: (data: string) => void,
  onError: (data: string) => void,
  onExit: (code: number | null) => void
): Promise<{ success: boolean; message: string; port?: number }> {
  const existingProcess = runningProcesses.get(projectId);
  if (existingProcess) {
    return { success: false, message: "Project is already running" };
  }
  
  const projectRoot = getProjectWorkspace(projectId);
  
  try {
    await fs.access(projectRoot);
  } catch {
    return { success: false, message: "Project directory not found" };
  }
  
  const { type, command, args } = await detectProjectType(projectRoot);
  
  onOutput(`[DevAssist] Detected project type: ${type}\n`);
  onOutput(`[DevAssist] Running: ${command} ${args.join(" ")}\n\n`);
  
  const port = 3000 + projectId;
  const env = { 
    ...process.env, 
    PORT: String(port),
    NODE_ENV: "development"
  };
  
  const child = spawn(command, args, {
    cwd: projectRoot,
    env,
    shell: true,
  });

  // Indicate NixOS environment in the console
  onOutput(`[DevAssist] Environment: NixOS (Docker)\n`);
  onOutput(`[DevAssist] Started project ${projectId} with command: ${command} ${args.join(" ")}\n`);
  onOutput(`[DevAssist] Preview available at http://0.0.0.0:${port}\n\n`);
  
  runningProcesses.set(projectId, {
    process: child,
    projectId,
    port,
    startTime: new Date()
  });
  
  child.stdout?.on("data", (data) => {
    onOutput(data.toString());
  });
  
  child.stderr?.on("data", (data) => {
    onError(data.toString());
  });
  
  child.on("exit", (code) => {
    runningProcesses.delete(projectId);
    onExit(code);
  });
  
  child.on("error", (err) => {
    onError(`Process error: ${err.message}\n`);
    runningProcesses.delete(projectId);
  });
  
  return { success: true, message: `Started on port ${port}`, port };
}

export function stopProject(projectId: number): { success: boolean; message: string } {
  const running = runningProcesses.get(projectId);
  if (!running) {
    return { success: false, message: "Project is not running" };
  }
  
  running.process.kill("SIGTERM");
  setTimeout(() => {
    if (runningProcesses.has(projectId)) {
      running.process.kill("SIGKILL");
      runningProcesses.delete(projectId);
    }
  }, 5000);
  
  return { success: true, message: "Project stopped" };
}

export function isProjectRunning(projectId: number): boolean {
  return runningProcesses.has(projectId);
}

export function getProjectPort(projectId: number): number | undefined {
  return runningProcesses.get(projectId)?.port;
}

export function getRunningProjects(): number[] {
  return Array.from(runningProcesses.keys());
}
