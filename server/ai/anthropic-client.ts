import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

// Оптимизация токенов: обрезка длинного контента
export function truncateContent(content: string, maxChars: number = 50000): string {
  if (content.length <= maxChars) return content;
  const half = Math.floor(maxChars / 2);
  return content.slice(0, half) + "\n\n... [truncated] ...\n\n" + content.slice(-half);
}

// Оптимизация: сжатие списка файлов
export function compressFileTree(files: string[], maxFiles: number = 100): string[] {
  if (files.length <= maxFiles) return files;
  const priorityFiles = files.filter(f => 
    f.includes("src/") || f.includes("server/") || f.includes("client/") ||
    f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".json")
  );
  return priorityFiles.slice(0, maxFiles);
}

export type { Anthropic };
