import { getAnthropicClient } from "./anthropic-client";
import { pickModel, getSystemPrompt, parseAgentResponse, type AgentResponse } from "./model-router";
import { executeActions, type ToolResult } from "./tool-executor";
import type { Response } from "express";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface OrchestratorOptions {
  maxIterations?: number;
  projectContext?: {
    fileTree?: string[];
    currentFile?: { name: string; language: string; content: string } | null;
  };
}

export async function runAgentLoop(
  initialPrompt: string,
  res: Response,
  options: OrchestratorOptions = {}
): Promise<{ messages: ChatMessage[]; toolResults: ToolResult[] }> {
  const client = getAnthropicClient();
  const maxIterations = options.maxIterations || 15;
  const model = pickModel("agent");
  const systemPrompt = getSystemPrompt(options.projectContext || {});
  
  const messages: ChatMessage[] = [{ role: "user", content: initialPrompt }];
  const allToolResults: ToolResult[] = [];
  
  for (let i = 0; i < maxIterations; i++) {
    res.write(`data: ${JSON.stringify({ step: i + 1, status: "thinking" })}\n\n`);
    
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content
        }))
      });
      
      const content = response.content[0].type === "text" ? response.content[0].text : "";
      messages.push({ role: "assistant", content });
      
      res.write(`data: ${JSON.stringify({ step: i + 1, status: "response", content })}\n\n`);
      
      const agentResponse = parseAgentResponse(content);
      
      if (agentResponse.actions.length === 0) {
        res.write(`data: ${JSON.stringify({ step: i + 1, status: "done", message: agentResponse.message })}\n\n`);
        break;
      }
      
      res.write(`data: ${JSON.stringify({ 
        step: i + 1, 
        status: "executing", 
        actions: agentResponse.actions.map(a => ({ type: a.type, path: a.path }))
      })}\n\n`);
      
      const results = await executeActions(agentResponse.actions);
      allToolResults.push(...results);
      
      const hasErrors = results.some(r => !r.success);
      
      const toolResultMessage = results.map((r, idx) => {
        const action = agentResponse.actions[idx];
        return `[${action.type}${action.path ? ` ${action.path}` : ""}]: ${r.success ? "SUCCESS" : "FAILED"}\n${r.output || r.error || ""}`;
      }).join("\n\n");
      
      messages.push({ role: "user", content: `Tool execution results:\n\n${toolResultMessage}` });
      
      res.write(`data: ${JSON.stringify({ 
        step: i + 1, 
        status: hasErrors ? "error" : "executed",
        results: results.map(r => ({ success: r.success, output: r.output?.substring(0, 200), error: r.error }))
      })}\n\n`);
      
      if (!hasErrors && agentResponse.message?.toLowerCase().includes("done")) {
        break;
      }
      
    } catch (error) {
      console.error("Agent loop error:", error);
      res.write(`data: ${JSON.stringify({ step: i + 1, status: "error", error: "Agent execution failed" })}\n\n`);
      break;
    }
  }
  
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  
  return { messages, toolResults: allToolResults };
}

export async function planTask(userRequest: string, projectContext: {
  fileTree?: string[];
  currentFile?: { name: string; language: string; content: string } | null;
}): Promise<{ steps: string[]; model: string }> {
  const client = getAnthropicClient();
  const model = pickModel("plan");
  
  const planPrompt = `Analyze this request and create a compressed task plan.

User request: "${userRequest}"

${projectContext.fileTree?.length ? `Project files:\n${projectContext.fileTree.slice(0, 30).join("\n")}` : ""}

Respond with ONLY a JSON object:
{
  "steps": ["step1", "step2", "step3"]
}

Keep steps brief (3-5 words each). Max 5 steps.`;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 200,
      messages: [{ role: "user", content: planPrompt }]
    });
    
    const content = response.content[0].type === "text" ? response.content[0].text : "{}";
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { steps: parsed.steps || [], model };
    }
    
    return { steps: [], model };
  } catch (error) {
    console.error("Planning error:", error);
    return { steps: [], model };
  }
}

export async function criticReview(
  diff: string,
  context: string
): Promise<{ approved: boolean; feedback: string }> {
  const client = getAnthropicClient();
  const model = pickModel("critic");
  
  const reviewPrompt = `Review this code change for issues.

Context: ${context}

Diff:
${diff}

Check for:
1. Syntax errors
2. Missing error handling
3. Security issues
4. Breaking changes

Respond with JSON:
{
  "approved": true/false,
  "feedback": "brief explanation"
}`;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 300,
      messages: [{ role: "user", content: reviewPrompt }]
    });
    
    const content = response.content[0].type === "text" ? response.content[0].text : "{}";
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { 
        approved: parsed.approved ?? true, 
        feedback: parsed.feedback || "No issues found" 
      };
    }
    
    return { approved: true, feedback: "Review completed" };
  } catch (error) {
    console.error("Critic error:", error);
    return { approved: true, feedback: "Review skipped due to error" };
  }
}
