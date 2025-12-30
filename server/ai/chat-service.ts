import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "./anthropic-client";
import { MODELS, pickModel, getSystemPrompt, type TaskType, type ModelOverride } from "./model-router";
import { AGENT_TOOLS } from "./tools";
import { executeAction, setProjectContext, clearProjectContext, type ToolResult } from "./tool-executor";
import { getProjectWorkspace } from "../project-runner";
import type { Response } from "express";
import { db } from "../db";
import { messages as messagesTable } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatOptions {
  taskType?: TaskType;
  projectContext?: {
    fileTree?: string[];
    currentFile?: { name: string; language: string; content: string } | null;
  };
  maxTokens?: number;
  conversationId?: number;
  projectId?: number;
  modelOverride?: ModelOverride;
}

const MAX_AGENT_STEPS = 200;

export async function streamChatResponse(
  messages: ChatMessage[],
  res: Response,
  options: ChatOptions = {}
): Promise<{ content: string; metadata?: any }> {
  const client = getAnthropicClient();
  
  const lastUserMsg = messages.filter(m => m.role === "user").pop()?.content || "";
  
  const model = pickModel("agent", options.modelOverride);
  const systemPrompt = getSystemPrompt(options.projectContext || {});

  // Redirect Opus to Sonnet if requested
  let currentModel = model;
  if (currentModel === MODELS.opus || options.modelOverride === "opus") {
    currentModel = MODELS.sonnet;
  }

  return await runAgentLoop(client, messages, res, currentModel, systemPrompt, options);
}

async function runSimpleChat(
  client: Anthropic,
  messages: ChatMessage[],
  res: Response,
  model: string,
  systemPrompt: string,
  options: ChatOptions
): Promise<{ content: string; metadata?: any }> {
  const anthropicMessages = messages.map(msg => ({
    role: msg.role as "user" | "assistant",
    content: msg.content
  }));

  let fullContent = "";

  try {
    const stream = await client.messages.stream({
      model,
      max_tokens: options.maxTokens || 8192,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" }
        }
      ],
      messages: anthropicMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        const text = event.delta.text;
        fullContent += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, fullContent, model })}\n\n`);
    return { content: fullContent };
  } catch (error) {
    console.error("Anthropic streaming error:", error);
    res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
    throw error;
  }
}

async function runAgentLoop(
  client: Anthropic,
  messages: ChatMessage[],
  res: Response,
  model: string,
  systemPrompt: string,
  options: ChatOptions
): Promise<{ content: string; metadata?: any }> {
  // Set project context for tool execution
  if (options.projectId) {
    setProjectContext(options.projectId);
  }
  
  const anthropicMessages: Anthropic.MessageParam[] = messages.map(msg => ({
    role: msg.role as "user" | "assistant",
    content: msg.content
  }));

  let fullContent = "";
  let step = 0;
  const events: any[] = [];

  while (step < MAX_AGENT_STEPS) {
    step++;

    try {
      const response = await client.messages.create({
        model,
        max_tokens: options.maxTokens || 8192,
        system: [
          {
            type: "text",
            text: systemPrompt + "\n\nIMPORTANT: You MUST use the provided tools to perform actions. NEVER output XML tags like <write_to_file>. Call the write_file tool instead.",
            cache_control: { type: "ephemeral" }
          }
        ],
        tools: AGENT_TOOLS,
        tool_choice: { type: "auto" },
        messages: anthropicMessages,
      }, {
        timeout: 12000000, // 200 minutes timeout for very long tasks, as a header/option
      });

      let hasToolUse = false;
      let textContent = "";
      const toolResults: { tool_use_id: string; result: string }[] = [];

      for (const block of response.content) {
        if (block.type === "text") {
          textContent += block.text;
          res.write(`data: ${JSON.stringify({ content: block.text, type: 'text' })}\n\n`);
          fullContent += block.text;
        } else if (block.type === "tool_use") {
          hasToolUse = true;
          const toolName = block.name;
          const toolInput = block.input as Record<string, string>;
          
          res.write(`data: ${JSON.stringify({ 
            type: 'tool_use',
            toolUse: { 
              name: toolName, 
              input: toolInput 
            } 
          })}\n\n`);
          
          events.push({
            type: 'tool_use',
            toolUse: { name: toolName, input: toolInput }
          });

          const action = mapToolToAction(toolName, toolInput);
          const result = await executeAction(action);
          
          res.write(`data: ${JSON.stringify({ 
            type: 'tool_result',
            toolResult: { 
              name: toolName, 
              success: result.success,
              output: result.output?.slice(0, 500),
              error: result.error
            }
          })}\n\n`);
          
          events.push({
            type: 'tool_result',
            toolResult: { name: toolName, success: result.success, error: result.error }
          });

          toolResults.push({
            tool_use_id: block.id,
            result: result.success 
              ? (result.output || "Success") 
              : `Error: ${result.error}`
          });
        }
      }

      if (!hasToolUse) {
        res.write(`data: ${JSON.stringify({ done: true, fullContent, model, agentSteps: step, type: 'response' })}\n\n`);
        return { content: fullContent, metadata: events.length > 0 ? { events } : undefined };
      }

      anthropicMessages.push({
        role: "assistant",
        content: response.content
      });

      anthropicMessages.push({
        role: "user",
        content: toolResults.map(tr => ({
          type: "tool_result" as const,
          tool_use_id: tr.tool_use_id,
          content: tr.result
        }))
      });

      if (response.stop_reason === "end_turn") {
        res.write(`data: ${JSON.stringify({ done: true, fullContent, model, agentSteps: step })}\n\n`);
        return { 
          content: fullContent, 
          metadata: events.length > 0 ? { events } : undefined 
        };
      }

    } catch (error) {
      console.error("Agent step error:", error);
      res.write(`data: ${JSON.stringify({ error: "Agent step failed", step })}\n\n`);
      break;
    }
  }

  res.write(`data: ${JSON.stringify({ done: true, fullContent, model, agentSteps: step, maxStepsReached: step >= MAX_AGENT_STEPS })}\n\n`);
  return { content: fullContent, metadata: events.length > 0 ? { events } : undefined };
}

function mapToolToAction(toolName: string, input: Record<string, string>) {
  switch (toolName) {
    case "read_file":
      return { type: "read_file" as const, path: input.path };
    case "write_file":
      return { type: "write_to_file" as const, path: input.path, content: input.content };
    case "edit_file":
      return { type: "apply_diff" as const, path: input.path, search: input.search, replace: input.replace };
    case "list_files":
      return { type: "list_files" as const, path: input.path };
    case "search_code":
      return { type: "search_code" as const, query: input.query };
    case "run_command":
      return { type: "run_command" as const, command: input.command };
    default:
      return { type: "message" as const, content: `Unknown tool: ${toolName}` };
  }
}

export async function classifyIntent(userMessage: string): Promise<"simple" | "complex" | "agent"> {
  const agentKeywords = [
    "create", "make", "build", "write", "add", "implement", "generate",
    "fix", "update", "change", "modify", "refactor", "delete", "remove",
    "run", "execute", "install", "setup", "configure", "list", "show", "read",
    "создай", "сделай", "напиши", "добавь", "исправь", "измени", "удали",
    "покажи", "прочитай", "файл", "file", "code", "код"
  ];
  
  const lowerMsg = userMessage.toLowerCase();
  const hasAgentKeyword = agentKeywords.some(kw => lowerMsg.includes(kw));

  if (hasAgentKeyword) {
    return "agent";
  }

  return "complex";
}
