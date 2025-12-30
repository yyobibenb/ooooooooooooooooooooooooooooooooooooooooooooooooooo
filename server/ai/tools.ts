import Anthropic from "@anthropic-ai/sdk";

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file at the specified path. Use this to understand existing code before making changes.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "The file path to read, relative to project root"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: "Create a new file or completely overwrite an existing file with new content.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "The file path to write to, relative to project root"
        },
        content: {
          type: "string",
          description: "The complete content to write to the file"
        }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "edit_file",
    description: "Make a targeted edit to a file by replacing specific text. Use this for small changes instead of rewriting the entire file.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "The file path to edit"
        },
        search: {
          type: "string",
          description: "The exact text to find and replace (must be unique in the file)"
        },
        replace: {
          type: "string",
          description: "The text to replace it with"
        }
      },
      required: ["path", "search", "replace"]
    }
  },
  {
    name: "list_files",
    description: "List all files in a directory. Use this to understand project structure.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "The directory path to list, relative to project root. Use '.' for root."
        }
      },
      required: ["path"]
    }
  },
  {
    name: "search_code",
    description: "Search for text or patterns across all files in the project using grep.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The text or regex pattern to search for"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "run_command",
    description: "Execute a shell command. Use for running tests, installing packages, or other CLI operations.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute"
        }
      },
      required: ["command"]
    }
  }
];

export type ToolName = "read_file" | "write_file" | "edit_file" | "list_files" | "search_code" | "run_command";
