export type TaskType = "classify" | "chat" | "agent" | "plan" | "critic";
export type ModelOverride = "auto" | "haiku" | "sonnet" | "opus";

// Claude 4.5 models - правильные API идентификаторы
export const MODELS = {
  haiku: "claude-haiku-4-5",     // Claude 4.5 Haiku (быстрый)
  sonnet: "claude-sonnet-4-5",   // Claude 4.5 Sonnet (сбалансированный)
  opus: "claude-opus-4-5"        // Claude 4.5 Opus (самый мощный)
} as const;

export function pickModel(task: TaskType, override?: ModelOverride): string {
  // Если пользователь выбрал конкретную модель - используем её
  if (override && override !== "auto") {
    return MODELS[override];
  }
  
  // Auto режим - выбираем по задаче
  switch (task) {
    case "classify":
      return MODELS.haiku;
    case "chat":
      return MODELS.sonnet;
    case "plan":
      return MODELS.sonnet;
    case "critic":
      return MODELS.sonnet;
    case "agent":
      return MODELS.opus;
    default:
      return MODELS.sonnet;
  }
}

// Системный промпт по запросу пользователя
export function getSystemPrompt(projectContext: {
  fileTree?: string[];
  currentFile?: { name: string; language: string; content: string } | null;
}): string {
  const fileTreeStr = projectContext.fileTree?.length 
    ? `\n<files>${projectContext.fileTree.join(", ")}</files>`
    : '';
  
  const currentFileStr = projectContext.currentFile
    ? `\n<current file="${projectContext.currentFile.name}" lang="${projectContext.currentFile.language}">\n${projectContext.currentFile.content}\n</current>`
    : '';

  return `<role>
You are Agent, an autonomous software engineer. Use the tools to assist the user.
</role>

<environment>
- Linux (NixOS), Node.js, PostgreSQL
- Use provided tools to control the machine
- Never use Docker or virtual environments
</environment>

<autonomy>
- Work autonomously, reduce user's cognitive load
- Only return when task is complete or you need user input
- Continue working until fully done
</autonomy>

<communication>
- NEVER use emoji
- Be concise and direct
- Use the same language as user
- Don't explain code unless asked
</communication>

<workflow>
1. Understand the request
2. Use list_files to explore structure
3. Use read_file to understand existing code
4. Make minimal changes with write_file or edit_file
5. Verify and report completion
</workflow>

<code_rules>
- Understand file conventions first, then mimic them
- Check if libraries exist before using
- Look at existing components before creating new
- Prefer editing over rewriting
- Follow security best practices
</code_rules>

<tool_usage>
CRITICAL: Use the provided tools for ALL actions:
- read_file: Read file contents
- write_file: Create or overwrite files  
- edit_file: Make targeted edits (search/replace)
- list_files: List directory contents
- search_code: Search across files
- run_command: Execute shell commands

NEVER output XML tags. NEVER write <write_to_file> or similar. Always call the tools directly.
</tool_usage>

<project>
Stack: React + Vite, Express, Drizzle ORM, PostgreSQL, TailwindCSS, shadcn/ui
Structure: client/, server/, shared/
</project>
${fileTreeStr}${currentFileStr}`;
}

export interface AgentAction {
  type: "create_file" | "read_file" | "write_to_file" | "apply_diff" | "run_command" | "list_files" | "search_code" | "message";
  path?: string;
  content?: string;
  search?: string;
  replace?: string;
  command?: string;
  query?: string;
}

export interface AgentResponse {
  thinking?: string;
  actions: AgentAction[];
  message?: string;
}

export function parseAgentResponse(content: string): AgentResponse {
  try {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    const directJson = content.match(/\{[\s\S]*"actions"[\s\S]*\}/);
    if (directJson) {
      return JSON.parse(directJson[0]);
    }
  } catch (e) {
    // Not JSON, return as message
  }
  
  return {
    actions: [],
    message: content
  };
}
