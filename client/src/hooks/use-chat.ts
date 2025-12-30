import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

// Types matching the server/replit_integrations/chat/routes.ts
interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return (await res.json()) as Conversation[];
    },
  });
}

export function useConversation(id: number) {
  return useQuery({
    queryKey: ["conversations", id],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch conversation");
      return (await res.json()) as Conversation & { messages: Message[] };
    },
    enabled: !isNaN(id) && id > 0,
  });
}

export function useProjectConversation(projectId: number) {
  return useQuery({
    queryKey: ["project-conversation", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/conversation`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch project conversation");
      return (await res.json()) as Conversation & { messages: Message[] };
    },
    enabled: !isNaN(projectId) && projectId > 0,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return (await res.json()) as Conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export type ModelChoice = "auto" | "haiku" | "sonnet" | "opus";

export interface ToolAction {
  name: string;
  input: Record<string, string>;
  result?: {
    success: boolean;
    output?: string;
    error?: string;
  };
}

export function useChatStream(conversationId: number, projectId: number) {
  const queryClient = useQueryClient();
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const [agentStep, setAgentStep] = useState(0);
  const [toolActions, setToolActions] = useState<ToolAction[]>([]);
  const [completedActions, setCompletedActions] = useState<ToolAction[]>([]);
  const [elapsedTime, setElapsedTime] = useState<string | undefined>();

  const sendMessage = async (content: string, modelOverride: ModelChoice = "auto") => {
    setIsStreaming(true);
    setStreamingContent("");
    setAgentStep(0);
    setToolActions([]);
    setElapsedTime(undefined);

    queryClient.setQueryData(["project-conversation", projectId], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        messages: [
          ...old.messages,
          { id: Date.now(), role: "user", content, createdAt: new Date().toISOString() },
        ],
      };
    });

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, modelOverride }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to send message");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) throw new Error("No stream reader");

      let fullResponse = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.content) {
                fullResponse += data.content;
                setStreamingContent(fullResponse);
              }
              
              if (data.agentStep) {
                setAgentStep(data.agentStep);
              }
              
              if (data.toolUse) {
                setToolActions(prev => [...prev, { 
                  name: data.toolUse.name, 
                  input: data.toolUse.input 
                }]);
              }
              
              if (data.toolResult) {
                setToolActions(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.name === data.toolResult.name) {
                    last.result = {
                      success: data.toolResult.success,
                      output: data.toolResult.output,
                      error: data.toolResult.error
                    };
                  }
                  return updated;
                });
              }
              
              if (data.done) {
                setIsStreaming(false);
                if (data.model) setUsedModel(data.model);
                setCompletedActions(prev => [...prev, ...toolActions]);
                queryClient.invalidateQueries({ queryKey: ["project-conversation", projectId] });
              }
            } catch (e) {
              console.error("Error parsing SSE chunk", e);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setIsStreaming(false);
    }
  };

  return { sendMessage, streamingContent, isStreaming, usedModel, agentStep, toolActions, completedActions };
}
