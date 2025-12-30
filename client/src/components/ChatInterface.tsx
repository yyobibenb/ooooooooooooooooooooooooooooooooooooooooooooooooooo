import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatStream, useConversations, useCreateConversation, useConversation, type Message } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { type File as FileType } from "@shared/schema";

interface ChatInterfaceProps {
  currentFile?: FileType | null;
}

export function ChatInterface({ currentFile }: ChatInterfaceProps) {
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  
  const { data: conversations, isLoading: isLoadingConversations } = useConversations();
  const { data: activeConversation, isLoading: isLoadingMessages } = useConversation(activeConversationId);
  const createConversation = useCreateConversation();
  const { sendMessage, isStreaming, streamedContent } = useChatStream(activeConversationId || 0);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-select most recent conversation
  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeConversation?.messages, streamedContent, isStreaming]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    let conversationId = activeConversationId;
    
    if (!conversationId) {
      // Create new conversation first
      try {
        const newConv = await createConversation.mutateAsync("New Chat");
        setActiveConversationId(newConv.id);
        conversationId = newConv.id;
      } catch (e) {
        return; // Error handled in hook
      }
    }

    // Append context if available
    let messageContent = input;
    if (currentFile) {
      messageContent = `[Context: Active file is ${currentFile.name} (${currentFile.language})]\n\n${messageContent}`;
    }

    setInput("");
    await sendMessage(messageContent);
  };

  const handleNewChat = () => {
    createConversation.mutate("New Chat", {
      onSuccess: (data) => setActiveConversationId(data.id),
    });
  };

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Header */}
      <div className="h-10 px-4 border-b border-border flex items-center justify-between bg-muted/10">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>AI Assistant</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewChat}>
          <MessageSquarePlus className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        {!activeConversationId && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-4">
            <Bot className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">Start a conversation to get help with your code.</p>
          </div>
        )}

        {activeConversation?.messages?.map((msg) => (
          <div key={msg.id} className={cn("flex gap-3 text-sm", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
              msg.role === "user" ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted border-border text-muted-foreground"
            )}>
              {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={cn(
              "flex flex-col max-w-[85%]", 
              msg.role === "user" ? "items-end" : "items-start"
            )}>
              <div className={cn(
                "px-4 py-2.5 rounded-2xl shadow-sm",
                msg.role === "user" 
                  ? "bg-primary text-primary-foreground rounded-tr-sm" 
                  : "bg-card border border-border rounded-tl-sm text-foreground"
              )}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content.replace(/\[Context:.*?\]\n\n/, '')}</p>
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 opacity-50">
                {format(new Date(msg.createdAt), "HH:mm")}
              </span>
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex gap-3 text-sm">
            <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 text-muted-foreground">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex flex-col max-w-[85%] items-start">
              <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-card border border-border text-foreground shadow-sm">
                 <p className="whitespace-pre-wrap leading-relaxed">{streamedContent}<span className="inline-block w-1.5 h-3.5 bg-primary ml-1 animate-pulse" /></p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-background">
        <div className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={currentFile ? `Ask about ${currentFile.name}...` : "Type a message..."}
            className="min-h-[80px] w-full resize-none pr-12 bg-muted/30 border-border focus:ring-primary/20 focus:border-primary font-sans text-sm"
          />
          <Button 
            size="icon" 
            className="absolute bottom-3 right-3 h-8 w-8 rounded-lg transition-transform active:scale-95"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="mt-2 flex justify-between items-center px-1">
          <p className="text-[10px] text-muted-foreground">
            {currentFile ? "Context active" : "No file context"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
