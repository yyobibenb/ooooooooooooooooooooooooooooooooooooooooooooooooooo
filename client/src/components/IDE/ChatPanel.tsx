import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStream, useProjectConversation, type ModelChoice, type ToolAction } from "@/hooks/use-chat";
import { Send, ChevronDown, Loader2, CheckCircle, XCircle, Paperclip, Copy, Check, FileCode, Eye, Pencil, Terminal, FolderOpen, Lightbulb, Plus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AIProcessVisualization } from "@/components/AIProcessVisualization";
import { FileOperationDisplay } from "@/components/FileOperationDisplay";
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
    if (actions.length === 0 && !content) return "Thinking...";
    const lastAction = actions[actions.length - 1];
    if (lastAction && !lastAction.result) {
      if (lastAction.name === "read_file") return `Reading ${lastAction.input.path}...`;
      if (lastAction.name === "write_file") return `Writing ${lastAction.input.path}...`;
      if (lastAction.name === "run_command") return `Running: ${lastAction.input.command}...`;
      return `Executing ${lastAction.name}...`;
    }
    return "Analyzing and generating...";
  };

  return (
    <div className="rounded-xl backdrop-blur-md bg-white/40 border border-white/60 p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-blue-400 animate-ping opacity-75" />
        </div>
        <span className="text-sm font-medium text-gray-700">{getStepDescription()}</span>
      </div>
      
      {actions.length > 0 && (
        <div className="space-y-2">
          {actions.map((action, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-gray-500 bg-white/30 px-2 py-1.5 rounded-lg border border-white/40">
              {action.result ? (
                action.result.success ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />
              ) : (
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
              )}
              <span className="font-mono truncate flex-1">
                {action.name}({action.input.path || action.input.command || ""})
              </span>
            </div>
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
  const [processActions, setProcessActions] = useState<any[]>([]);
  const [currentFileOp, setCurrentFileOp] = useState<any>(null);

  const { data: conversation } = useProjectConversation(projectId);
  const conversationId = conversation?.id || 0;
  const messages: Message[] = conversation?.messages || [];
  
  const { sendMessage, streamedContent, isStreaming, streamEvents } = useChatStream(conversationId, projectId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamedContent, isStreaming, streamEvents]);

  // Update process actions from stream events - real-time file operations
  useEffect(() => {
    const processedActions: any[] = [];
    let latestFileOp = null;
    let thinkingText = "";
    let planText = "";
    
    for (let i = 0; i < streamEvents.length; i++) {
      const e = streamEvents[i];
      
      // Collect thinking blocks
      if (e.type === "thinking" && e.thinking) {
        thinkingText += e.thinking;
      }
      
      if (e.type === "tool_use") {
        const toolName = e.toolUse?.name || "unknown";
        const path = e.toolUse?.input?.path;
        const content = e.toolUse?.input?.content;
        const command = e.toolUse?.input?.command;
        
        let actionType: "read" | "write" | "create" | "command" | "thinking" | "planning" = "command";
        
        if (toolName === "read_file") actionType = "read";
        if (toolName === "write_file") actionType = "write";
        if (toolName === "run_command") actionType = "command";
        
        // Check if there's a corresponding tool_result
        const resultEvent = streamEvents.find((ev, idx) => 
          idx > i && ev.type === "tool_result" && ev.toolResult?.name === toolName
        );
        
        const status = resultEvent 
          ? (resultEvent.toolResult?.success ? "completed" : "error")
          : "in_progress";
        
        const action = {
          id: `action-${i}`,
          type: actionType,
          name: toolName,
          path: path || command,
          status,
          preview: content ? content.slice(0, 500) : command ? `$ ${command}` : undefined,
        };
        
        processedActions.push(action);
        
        // Track file operations (read or write)
        if ((actionType === "read" || actionType === "write") && path) {
          latestFileOp = {
            type: actionType as "read" | "write" | "create",
            path,
            status,
            preview: content,
            error: resultEvent?.toolResult?.success === false ? resultEvent.toolResult?.output : undefined,
          };
        }
      }
    }
    
    // Extract plan from thinking if it contains certain keywords
    if (thinkingText.toLowerCase().includes("план") || thinkingText.toLowerCase().includes("план")) {
      const lines = thinkingText.split('\n');
      const planLines = lines.filter(line => 
        line.toLowerCase().includes("план") || 
        line.includes("1.") || 
        line.includes("2.") ||
        line.includes("3.")
      );
      if (planLines.length > 0) {
        planText = planLines.slice(0, 3).join('\n');
      }
    }
    
    setProcessActions(processedActions);
    setCurrentFileOp(latestFileOp);
  }, [streamEvents]);

  const renderAgentStep = (step: any, index: number) => {
    switch (step.type) {
      case 'thinking':
        return (
          <div key={`step-${index}`} className="flex items-center gap-2 text-xs text-gray-500 animate-pulse py-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Thinking... (Step {step.agentStep})</span>
          </div>
        );
      case 'tool_use':
        return (
          <div key={`step-${index}`} className="bg-white/30 border border-white/40 rounded-xl p-3 my-2 text-xs shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-2 font-medium text-gray-700 mb-1.5">
              <Terminal className="w-3.5 h-3.5 text-blue-500" />
              <span>Using tool: {step.toolUse.name}</span>
            </div>
            {step.toolUse.input.path && (
              <div className="flex items-center gap-1.5 text-gray-500 font-mono text-[10px] bg-gray-100/50 px-2 py-1 rounded">
                <FileCode className="w-3 h-3" />
                <span>{step.toolUse.input.path}</span>
              </div>
            )}
          </div>
        );
      case 'tool_result':
        return (
          <div key={`step-${index}`} className="flex items-center gap-2 text-[10px] py-1 pl-2 text-gray-500">
            {step.toolResult.success ? (
              <CheckCircle className="w-3 h-3 text-green-500" />
            ) : (
              <XCircle className="w-3 h-3 text-red-500" />
            )}
            <span className="opacity-80">
              {step.toolResult.name} completed {step.toolResult.success ? 'successfully' : 'with error'}
            </span>
          </div>
        );
      default:
        return null;
    }
  };

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
      <div className="flex-1 overflow-y-auto space-y-4 mb-2 pr-1" ref={scrollRef}>
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 py-4">
            <p className="text-xs text-center">Ask anything about your code...</p>
            <p className="text-[10px] text-center text-gray-300">Drop files here to attach</p>
          </div>
        )}

        {messages.map((msg, msgIdx) => (
          <div key={msg.id} className={cn("text-sm mb-4", msg.role === "user" ? "text-right" : "")}>
            {msg.role === "user" ? (
              <div className="inline-block max-w-[85%] text-left px-4 py-3 rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] transition-all duration-200 animate-fadeIn border-none">
                {msg.content.replace(/\[Context:.*?\]\n\n/, '').replace(/\[Attached files:.*?\]\n\n/, '').replace(/\[Current file:.*?\]\n\n/, '')}
              </div>
            ) : (
              <>
                <div className="inline-block max-w-[95%] text-left px-4 py-3 hover:shadow-lg hover:shadow-gray-300/40 hover:scale-[1.01] transition-all duration-200 animate-fadeIn">
                  <MessageContent content={msg.content} />
                </div>
                
                {/* Display metadata events from saved messages */}
                {msg.metadata?.events && msg.metadata.events.length > 0 && (
                  <div className="space-y-2 mt-3 ml-2">
                    {/* Thinking events */}
                    {msg.metadata.events.filter((e: any) => e.type === "thinking").map((event: any, idx: number) => (
                      <div key={`thinking-saved-${msgIdx}-${idx}`} className="max-w-[85%] backdrop-blur-2xl bg-gradient-to-br from-amber-500/25 via-yellow-400/15 to-orange-300/10 border border-white/50 rounded-2xl p-3 animate-fadeIn hover:shadow-lg hover:shadow-amber-300/30 transition-all duration-300 shadow-lg shadow-amber-300/10">
                        <div className="flex items-start gap-2">
                          <div className="p-1.5 rounded-full bg-white/30 backdrop-blur-xl flex-shrink-0 mt-0.5">
                            <Lightbulb className="w-4 h-4 text-amber-700 dark:text-amber-200" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Thinking:</p>
                            {event.thinking && (
                              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-1">
                                {event.thinking}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* File operations events */}
                    {msg.metadata.events.filter((e: any) => e.type === "tool_use" && e.toolUse?.name !== "read_file" && e.toolUse?.name !== "search_code" && e.toolUse?.name !== "run_command").map((event: any, idx: number) => {
                      const toolName = event.toolUse?.name;
                      const path = event.toolUse?.input?.path;
                      const filePathDisplay = path?.includes('/') ? path.replace(/^.*\//, '') : path;
                      const isFolder = toolName === "list_files";
                      const label = isFolder ? "Created folder" : "Created successful";
                      return (
                        <div key={`created-${msgIdx}-${idx}`} className="max-w-[85%] backdrop-blur-2xl bg-gradient-to-br from-green-500/25 via-emerald-400/15 to-teal-300/10 border border-white/50 rounded-2xl p-3 animate-fadeIn hover:shadow-lg hover:shadow-green-300/30 transition-all duration-300 shadow-lg shadow-green-300/10">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-full bg-white/30 backdrop-blur-xl flex-shrink-0">
                              <CheckCircle className="w-4 h-4 text-green-700 dark:text-green-200" />
                            </div>
                            <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{label} <code className="font-mono font-bold text-green-700 dark:text-green-200">{filePathDisplay}</code></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {isStreaming && (
          <div className="space-y-3">
            {streamedContent && (
              <div className="text-left animate-fadeIn px-4 py-3">
                <MessageContent content={streamedContent} />
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-500 animate-pulse" />
              </div>
            )}
            
            {/* Thinking Events */}
            {streamEvents.filter((e) => e.type === "thinking").map((event, idx) => (
              <div key={`thinking-${idx}`} className="max-w-[85%] backdrop-blur-2xl bg-gradient-to-br from-amber-500/25 via-yellow-400/15 to-orange-300/10 border border-white/50 rounded-2xl p-3 mx-2 animate-fadeIn hover:shadow-lg hover:shadow-amber-300/30 transition-all duration-300 shadow-lg shadow-amber-300/10">
                <div className="flex items-start gap-2">
                  <div className="p-1.5 rounded-full bg-white/30 backdrop-blur-xl flex-shrink-0 mt-0.5">
                    <Lightbulb className="w-4 h-4 text-amber-700 dark:text-amber-200 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Thinking:</p>
                    {event.thinking && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-1">
                        {event.thinking}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* File Operations Events (all tool_use except read_file) */}
            {streamEvents.filter((e) => e.type === "tool_use" && e.toolUse?.name !== "read_file" && e.toolUse?.name !== "search_code" && e.toolUse?.name !== "run_command").map((event, idx) => {
              const toolName = event.toolUse?.name;
              const path = event.toolUse?.input?.path;
              const filePathDisplay = path?.includes('/') ? path.replace(/^.*\//, '') : path;
              const isFolder = toolName === "list_files";
              const label = isFolder ? "Created folder" : "Created successful";
              return (
                <div key={`created-${idx}`} className="max-w-[85%] backdrop-blur-2xl bg-gradient-to-br from-green-500/25 via-emerald-400/15 to-teal-300/10 border border-white/50 rounded-2xl p-3 mx-2 animate-fadeIn hover:shadow-lg hover:shadow-green-300/30 transition-all duration-300 shadow-lg shadow-green-300/10">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-full bg-white/30 backdrop-blur-xl flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-700 dark:text-green-200" />
                    </div>
                    <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{label} <code className="font-mono font-bold text-green-700 dark:text-green-200">{filePathDisplay}</code></span>
                  </div>
                </div>
              );
            })}
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
      <form onSubmit={handleSend} className="flex items-center gap-2 mb-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask..."
          disabled={isStreaming}
          className="flex-1 px-3 py-2 rounded-lg backdrop-blur-sm bg-white/50 border border-white/60 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-inset text-sm placeholder-gray-400 shadow-sm transition-all duration-200 disabled:opacity-50"
          data-testid="input-chat-message"
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className={cn(
            "p-2.5 rounded-lg backdrop-blur-md bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-400/60 text-white font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:hover:shadow-lg",
            !input.trim() || isStreaming ? "" : "hover:scale-105 active:scale-95"
          )}
          data-testid="button-send-message"
        >
          {isStreaming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}
