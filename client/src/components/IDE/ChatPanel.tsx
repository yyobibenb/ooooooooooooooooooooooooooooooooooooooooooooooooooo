import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStream, useProjectConversation, type ModelChoice, type ToolAction } from "@/hooks/use-chat";
import { Send, ChevronDown, Loader2, CheckCircle, XCircle, Paperclip, Copy, Check, FileCode, Eye, Pencil, Terminal, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";

const MODEL_OPTIONS: { value: ModelChoice; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "haiku", label: "Haiku" },
  { value: "sonnet", label: "Sonnet" },
  { value: "opus", label: "Opus" },
];

interface FSFile {
  id: string;
  name: string;
  path: string;
  language: string;
  content?: string;
}

interface ChatPanelProps {
  projectId: number;
  currentFile: FSFile | null;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

interface AttachedFile {
  name: string;
  path: string;
}

function ToolActionDisplay({ action, showDetails = false }: { action: ToolAction; showDetails?: boolean }) {
  const getActionIcon = () => {
    if (action.name === "read_file") return <Eye className="w-3 h-3 text-blue-500" />;
    if (action.name === "write_file") return <Pencil className="w-3 h-3 text-amber-500" />;
    if (action.name === "run_command") return <Terminal className="w-3 h-3 text-purple-500" />;
    if (action.name === "list_files") return <FolderOpen className="w-3 h-3 text-cyan-500" />;
    return <FileCode className="w-3 h-3 text-gray-500" />;
  };
  
  const getActionLabel = () => {
    if (action.name === "read_file") return "Reading file";
    if (action.name === "write_file") return "Writing file";
    if (action.name === "run_command") return "Running command";
    if (action.name === "list_files") return "Listing files";
    return action.name;
  };

  const getActionDescription = () => {
    if (action.input.path) return action.input.path;
    if (action.input.command) return action.input.command;
    return "";
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 backdrop-blur-sm bg-white/50 border border-white/60 rounded-xl text-xs text-gray-600 shadow-sm">
      {getActionIcon()}
      <span className="font-medium">{getActionLabel()}</span>
      {getActionDescription() && (
        <span className="text-gray-500 truncate font-mono text-[10px] bg-gray-100/80 px-1.5 py-0.5 rounded max-w-[150px]">
          {getActionDescription()}
        </span>
      )}
      {action.result ? (
        action.result.success ? (
          <CheckCircle className="w-3.5 h-3.5 text-green-500 ml-auto flex-shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-red-500 ml-auto flex-shrink-0" />
        )
      ) : (
        <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin ml-auto flex-shrink-0" />
      )}
    </div>
  );
}

function AgentStatusPanel({ step, actions, content }: { step: number; actions: ToolAction[]; content: string }) {
  const getStepDescription = () => {
    if (actions.length === 0 && !content) return "Analyzing request...";
    if (actions.some(a => a.name === "list_files" && !a.result)) return "Exploring project structure...";
    if (actions.some(a => a.name === "read_file" && !a.result)) return "Reading existing code...";
    if (actions.some(a => a.name === "write_file" && !a.result)) return "Writing new code...";
    if (actions.some(a => a.name === "run_command" && !a.result)) return "Executing command...";
    if (content) return "Generating response...";
    return "Processing...";
  };

  const completedActions = actions.filter(a => a.result);
  
  return (
    <div className="rounded-xl backdrop-blur-md bg-gradient-to-r from-blue-50/80 to-purple-50/80 border border-white/60 p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-semibold text-gray-700">AI is working</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <span>Step {step}</span>
          <span className="text-gray-300">|</span>
          <span>{completedActions.length} actions</span>
        </div>
      </div>
      
      <div className="text-xs text-gray-600 mb-2 flex items-center gap-2">
        <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
        <span>{getStepDescription()}</span>
      </div>
      
      {actions.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {actions.slice(-5).map((action, idx) => (
            <ToolActionDisplay key={idx} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="my-3 rounded-xl overflow-hidden backdrop-blur-sm border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800/90 border-b border-white/10">
        <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {/* Code */}
      <pre className="bg-gray-900/95 p-3 overflow-x-auto">
        <code className="text-xs font-mono text-gray-100 leading-relaxed">{code}</code>
      </pre>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-gray text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");
            
            if (match) {
              return <CodeBlock language={match[1]} code={codeString} />;
            }
            
            return (
              <code className="px-1.5 py-0.5 rounded-md backdrop-blur-sm bg-gray-100/80 text-gray-700 text-xs font-mono border border-gray-200/50" {...props}>
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
          },
          ul({ children }) {
            return <ul className="mb-2 pl-4 space-y-1 list-disc">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="mb-2 pl-4 space-y-1 list-decimal">{children}</ol>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ChatPanel({ projectId, currentFile }: ChatPanelProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelChoice>("auto");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const { data: conversation } = useProjectConversation(projectId);
  const conversationId = conversation?.id || 0;
  const messages: Message[] = conversation?.messages || [];
  
  const { sendMessage, streamingContent, isStreaming, agentStep, toolActions, completedActions } = useChatStream(conversationId, projectId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  useEffect(() => {
    if (!conversationId || isStreaming) return;
    
    const pendingKey = `pending_message_${projectId}`;
    const pendingMessage = localStorage.getItem(pendingKey);
    
    if (pendingMessage && messages.length === 0) {
      localStorage.removeItem(pendingKey);
      sendMessage(pendingMessage, selectedModel);
    }
  }, [conversationId, projectId, messages.length, isStreaming, sendMessage, selectedModel]);

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    
    for (const file of droppedFiles) {
      const filePath = `attached_assets/${file.name}`;
      
      const reader = new FileReader();
      reader.onload = async () => {
        const content = reader.result;
        
        try {
          if (typeof content === "string") {
            await fetch(`/api/fs/${projectId}/file`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: filePath, content }),
              credentials: "include",
            });
          } else if (content instanceof ArrayBuffer) {
            await fetch(`/api/fs/${projectId}/upload?path=${encodeURIComponent(filePath)}`, {
              method: "POST",
              body: content,
              credentials: "include",
            });
          }
          
          setAttachedFiles(prev => [...prev, { name: file.name, path: filePath }]);
          queryClient.invalidateQueries({ queryKey: ["/api/fs/files", projectId] });
        } catch (err) {
          console.error("Failed to upload file:", err);
        }
      };
      
      if (file.type.startsWith("text/") || file.name.match(/\.(js|ts|jsx|tsx|json|css|html|md|txt|py|sql|sh)$/)) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    }
  }, [queryClient, projectId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !conversationId) return;

    let fullPrompt = input;
    
    if (attachedFiles.length > 0) {
      fullPrompt += `\n\n[Attached files: ${attachedFiles.map(f => f.path).join(", ")}]`;
    }
    
    if (currentFile) {
      fullPrompt += `\n\n[Current file: ${currentFile.path}]\n\`\`\`${currentFile.language}\n${currentFile.content}\n\`\`\``;
    }

    setInput("");
    setAttachedFiles([]);
    await sendMessage(fullPrompt, selectedModel);
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div 
      className={cn(
        "h-full flex flex-col transition-colors",
        isDragging && "bg-blue-50/50 ring-2 ring-blue-300 ring-inset rounded-lg"
      )}
      onDrop={handleFileDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
    >
      {/* Top Bar: Model Selector */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="flex-1 flex items-center justify-between gap-2 px-4 py-2 rounded-xl backdrop-blur-sm bg-white/50 border border-white/60 text-sm text-gray-700 hover:bg-white/70 transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.6)]"
              data-testid="button-model-selector"
            >
              <span className="font-medium">{MODEL_OPTIONS.find(m => m.value === selectedModel)?.label}</span>
              <ChevronDown className="w-4 h-4 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[140px] backdrop-blur-xl bg-white/90 border border-white/60 shadow-lg rounded-xl">
            {MODEL_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setSelectedModel(option.value)}
                className={cn("text-sm", selectedModel === option.value && "bg-blue-50")}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-2 pr-1" ref={scrollRef}>
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 py-4">
            <p className="text-xs text-center">Ask anything about your code...</p>
            <p className="text-[10px] text-center text-gray-300">Drop files here to attach</p>
          </div>
        )}

        {messages.map((msg, msgIdx) => (
          <div key={msg.id} className={cn("text-sm", msg.role === "user" ? "text-right" : "")}>
            {msg.role === "user" ? (
              <div className="inline-block max-w-[90%] text-left px-3 py-2 rounded-lg bg-blue-500 text-white">
                {msg.content.split("\n\n[")[0]}
              </div>
            ) : (
              <div className="px-1 py-1 text-gray-700">
                <MessageContent content={msg.content} />
              </div>
            )}
            {msg.role === "assistant" && completedActions.length > 0 && msgIdx === messages.length - 1 && (
              <div className="mt-2 space-y-1 border-l-2 border-gray-200 pl-2 ml-1">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1">Actions performed</div>
                {completedActions.map((action, idx) => (
                  <ToolActionDisplay key={idx} action={action} />
                ))}
              </div>
            )}
          </div>
        ))}

        {isStreaming && (
          <div className="space-y-3">
            <AgentStatusPanel step={agentStep} actions={toolActions} content={streamingContent} />
            
            {streamingContent && (
              <div className="px-1 py-1 text-gray-700 text-sm">
                <MessageContent content={streamingContent} />
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-500 animate-pulse" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {attachedFiles.map((file, idx) => (
            <div 
              key={idx} 
              className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-600"
            >
              <Paperclip className="w-3 h-3" />
              <span className="truncate max-w-[100px]">{file.name}</span>
              <button 
                onClick={() => removeAttachedFile(idx)}
                className="text-gray-400 hover:text-red-500"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask..."
          disabled={isStreaming}
          className="flex-1 px-3 py-2 rounded-lg backdrop-blur-sm bg-white/50 border border-white/60 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-inset text-sm placeholder-gray-400 shadow-sm"
          data-testid="input-chat-message"
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="p-2 rounded-lg backdrop-blur-sm bg-blue-500/90 border border-blue-400/50 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-sm"
          data-testid="button-send-message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
