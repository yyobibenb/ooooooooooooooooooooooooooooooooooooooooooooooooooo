import { useState, useRef, useEffect } from "react";
import { useChatStream, useProjectConversation, type ModelChoice, type ToolAction } from "@/hooks/use-chat";
import { Send, User, Copy, Check, Wand2, Lightbulb, Zap, Brain, Cpu, ChevronDown, Sparkles, Maximize2, Minimize2, FileText, Terminal, Search, Folder, Edit3, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type File } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MODEL_OPTIONS: { value: ModelChoice; label: string; icon: typeof Zap; description: string }[] = [
  { value: "auto", label: "Auto", icon: Zap, description: "Smart routing" },
  { value: "haiku", label: "Haiku", icon: Zap, description: "Fast & cheap" },
  { value: "sonnet", label: "Sonnet", icon: Brain, description: "Balanced" },
  { value: "opus", label: "Opus", icon: Cpu, description: "Most capable" },
];

interface ChatPanelProps {
  projectId: number;
  currentFile: File | null;
  projectFiles?: File[];
  onExpand?: (expanded: boolean) => void;
  isExpanded?: boolean;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
        <span className="text-xs font-mono text-gray-500 uppercase tracking-wide">{language || "code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-all"
          data-testid="button-copy-code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto bg-gray-900">
        <code className="text-sm font-mono text-gray-100 leading-relaxed">{code}</code>
      </pre>
    </div>
  );
}

function JsonBlock({ data }: { data: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  let formatted = data;
  try {
    formatted = JSON.stringify(JSON.parse(data), null, 2);
  } catch {}

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-blue-200 bg-blue-50/50">
      <div className="flex items-center justify-between px-4 py-2 bg-blue-100/50 border-b border-blue-200">
        <span className="text-xs font-mono text-blue-600 uppercase tracking-wide flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          JSON Output
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-200/50 transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="text-sm font-mono text-blue-800 leading-relaxed">{formatted}</code>
      </pre>
    </div>
  );
}

function MessageContent({ content, role }: { content: string; role: string }) {
  return (
    <div className={cn(
      "prose prose-sm max-w-none",
      role === "user" ? "prose-invert" : "prose-gray"
    )}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");
            
            if (match && match[1] === "json") {
              return <JsonBlock data={codeString} />;
            }
            
            if (match) {
              return <CodeBlock language={match[1]} code={codeString} />;
            }
            
            return (
              <code className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-800 text-xs font-mono" {...props}>
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
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h3>;
          },
          strong({ children }) {
            return <strong className="font-semibold">{children}</strong>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-blue-300 pl-4 py-1 my-2 bg-blue-50/50 rounded-r-lg italic text-gray-600">
                {children}
              </blockquote>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3">
                <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="px-3 py-2 bg-gray-100 text-left text-xs font-semibold text-gray-700 border-b">{children}</th>;
          },
          td({ children }) {
            return <td className="px-3 py-2 text-sm border-b border-gray-100">{children}</td>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function ToolActionDisplay({ action }: { action: ToolAction }) {
  const getIcon = () => {
    switch (action.name) {
      case "read_file": return <FileText className="w-3 h-3" />;
      case "write_file": return <FileText className="w-3 h-3" />;
      case "edit_file": return <Edit3 className="w-3 h-3" />;
      case "list_files": return <Folder className="w-3 h-3" />;
      case "search_code": return <Search className="w-3 h-3" />;
      case "run_command": return <Terminal className="w-3 h-3" />;
      default: return <Zap className="w-3 h-3" />;
    }
  };

  const getLabel = () => {
    switch (action.name) {
      case "read_file": return `Reading ${action.input.path}`;
      case "write_file": return `Writing ${action.input.path}`;
      case "edit_file": return `Editing ${action.input.path}`;
      case "list_files": return `Listing ${action.input.path}`;
      case "search_code": return `Searching: ${action.input.query?.slice(0, 30)}...`;
      case "run_command": return `Running: ${action.input.command?.slice(0, 40)}...`;
      default: return action.name;
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/80 border border-blue-200/50 rounded-lg text-xs">
      <span className="text-blue-500">{getIcon()}</span>
      <span className="text-gray-600 flex-1 truncate">{getLabel()}</span>
      {action.result ? (
        action.result.success ? (
          <CheckCircle className="w-3 h-3 text-green-500" />
        ) : (
          <XCircle className="w-3 h-3 text-red-500" />
        )
      ) : (
        <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
      )}
    </div>
  );
}

export function ChatPanel({ projectId, currentFile, projectFiles = [], onExpand, isExpanded = false }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelChoice>("auto");

  const { data: conversation } = useProjectConversation(projectId);
  const conversationId = conversation?.id || 0;
  const messages: Message[] = conversation?.messages || [];
  
  const { sendMessage, streamingContent, isStreaming, usedModel, agentStep, toolActions } = useChatStream(conversationId, projectId);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !conversationId) return;

    let fullPrompt = input;
    if (currentFile) {
      fullPrompt += `\n\n[Context: Current file '${currentFile.name}']\n\`\`\`${currentFile.language}\n${currentFile.content}\n\`\`\``;
    }

    setInput("");
    await sendMessage(fullPrompt, selectedModel);
  };

  const handleGenerateCode = async () => {
    if (!currentFile || !conversationId) return;
    
    setIsGenerating(true);
    const prompt = `Improve this code:\n\`\`\`${currentFile.language}\n${currentFile.content}\n\`\`\``;
    
    await sendMessage(prompt);
    setIsGenerating(false);
  };

  const handleAskPlan = async () => {
    if (!conversationId) return;
    
    setIsGenerating(true);
    
    const projectContext = projectFiles.length > 0 
      ? `Files: ${projectFiles.map(f => f.name).join(', ')}`
      : '';
    
    const currentFileContext = currentFile
      ? `\nCurrent: ${currentFile.name}\n\`\`\`${currentFile.language}\n${currentFile.content}\n\`\`\``
      : '';
    
    const prompt = `Analyze and create improvement plan.${projectContext}${currentFileContext}`;
    
    await sendMessage(prompt);
    setIsGenerating(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with Model Selector and Expand */}
      <div className="flex items-center gap-2 mb-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/50 border border-white/60 text-sm text-gray-600 hover:bg-white/70 transition-all justify-between"
              data-testid="button-model-selector"
            >
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = MODEL_OPTIONS.find(m => m.value === selectedModel)!.icon;
                  return <Icon className="w-4 h-4" />;
                })()}
                <span>{MODEL_OPTIONS.find(m => m.value === selectedModel)?.label}</span>
              </div>
              <ChevronDown className="w-4 h-4 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 backdrop-blur-xl bg-white/90 border border-white/60">
            {MODEL_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setSelectedModel(option.value)}
                className={cn(
                  "flex items-center gap-2 cursor-pointer",
                  selectedModel === option.value && "bg-blue-50"
                )}
                data-testid={`menu-item-model-${option.value}`}
              >
                <option.icon className="w-4 h-4 text-gray-500" />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-800">{option.label}</span>
                  <span className="text-xs text-gray-500">{option.description}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        
        {onExpand && (
          <button
            onClick={() => onExpand(!isExpanded)}
            className="p-2 rounded-xl bg-white/50 border border-white/60 text-gray-500 hover:text-gray-700 hover:bg-white/70 transition-all"
            data-testid="button-expand-chat"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Action Buttons */}
      {currentFile && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={handleGenerateCode}
            disabled={isStreaming || isGenerating}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-purple-100 to-blue-100 text-purple-600 hover:from-purple-200 hover:to-blue-200 transition-all text-xs font-medium disabled:opacity-50 border border-purple-200/50"
            data-testid="button-generate-code"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Generate
          </button>
          <button
            onClick={handleAskPlan}
            disabled={isStreaming || isGenerating}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-100 to-orange-100 text-amber-600 hover:from-amber-200 hover:to-orange-200 transition-all text-xs font-medium disabled:opacity-50 border border-amber-200/50"
            data-testid="button-ask-plan"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Plan
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-3 pr-1" ref={scrollRef}>
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 py-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-sm text-center text-gray-500">Ask me anything about your code...</p>
            <p className="text-xs text-center text-gray-400">I can help you write, review, and improve code</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
              msg.role === "user"
                ? "bg-gradient-to-br from-blue-500 to-cyan-400 text-white"
                : "bg-gradient-to-br from-purple-500 to-pink-400 text-white"
            )}>
              {msg.role === "user" ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div className={cn("flex-1", msg.role === "user" ? "flex justify-end" : "", isExpanded ? "max-w-full" : "max-w-[85%]")}>
              <div className={cn(
                "rounded-2xl px-4 py-3",
                msg.role === "user"
                  ? "bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20"
                  : "bg-white/80 text-gray-700 border border-white/60 shadow-sm backdrop-blur-sm"
              )}>
                <MessageContent content={msg.content} role={msg.role} />
              </div>
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-400 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div className={cn("flex-1 space-y-2", isExpanded ? "max-w-full" : "max-w-[85%]")}>
              {agentStep > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200/50 rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    <span className="text-xs font-medium text-purple-600">Step {agentStep}</span>
                  </div>
                  <span className="text-xs text-gray-500">of {10}</span>
                </div>
              )}
              {toolActions.length > 0 && (
                <div className="space-y-1.5">
                  {toolActions.map((action, idx) => (
                    <ToolActionDisplay key={idx} action={action} />
                  ))}
                </div>
              )}
              {streamingContent ? (
                <div className="rounded-2xl px-4 py-3 bg-white/80 text-gray-700 border border-white/60 shadow-sm backdrop-blur-sm">
                  <MessageContent content={streamingContent} role="assistant" />
                  <span className="inline-block w-2 h-4 ml-0.5 bg-gradient-to-t from-purple-500 to-pink-400 animate-pulse align-middle rounded-sm" />
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                  <span>Thinking...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Used Model Indicator */}
      {usedModel && messages.length > 0 && (
        <div className="flex justify-center mb-2">
          <span className="text-[10px] text-gray-400 px-2 py-0.5 rounded-full bg-gray-100/50">
            Last: {usedModel}
          </span>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your code..."
          className="w-full px-4 py-3.5 pr-12 rounded-2xl bg-white/70 border border-white/60 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition-all text-sm placeholder-gray-400 shadow-sm"
          data-testid="input-chat-message"
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
          data-testid="button-send-message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
