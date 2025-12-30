import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

// Types matching the server/replit_integrations/chat/routes.ts
interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  metadata?: any;
  createdAt: string;
}

export interface StreamEvent {
  type: "thinking" | "tool_use" | "tool_result" | "content" | "done";
  agentStep?: number;
  thinking?: string;
  toolUse?: {
    name: string;
    input: Record<string, string>;
  };
  toolResult?: {
    name: string;
    success: boolean;
    output?: string;
    error?: string;
  };
  content?: string;
  fullContent?: string;
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

export function useChatStream(conversationId: number, projectId?: number) {
  const queryClient = useQueryClient();
  const [streamedContent, setStreamedContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);

  const sendMessage = async (content: string, modelOverride: ModelChoice = "auto") => {
    setIsStreaming(true);
    setStreamedContent("");
    setStreamEvents([]);

    // Optimistically update the UI
    const optimisticMsg = { id: Date.now(), role: "user" as const, content, createdAt: new Date().toISOString() };
    const queryKeys = [
      ["conversations", conversationId],
      projectId ? ["project-conversation", projectId] : null
    ].filter(Boolean) as any[];

    queryKeys.forEach(key => {
      queryClient.setQueryData(key, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: [...(old.messages || []), optimisticMsg],
        };
      });
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
              
              // Process text content
              if (data.type === 'text' && data.content) {
                fullResponse += data.content;
                setStreamedContent(fullResponse);
              }
              
              // Add to stream events (skip thinking events)
              if (data.type === 'tool_use' || data.type === 'tool_result') {
                console.log("Chat Event:", data.type, data);
                setStreamEvents(prev => [...prev, data as StreamEvent]);
              }
              
              if (data.done) {
                setIsStreaming(false);
                queryKeys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
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

  return { sendMessage, streamedContent, isStreaming, streamEvents };
}
