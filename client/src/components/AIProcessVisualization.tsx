import { useState, useEffect } from "react";
import { 
  Loader2, CheckCircle, AlertCircle, 
  FileText, Edit3, Plus, Eye, Terminal, Lightbulb, MapPin, Code2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionItem {
  id: string;
  type: "read" | "write" | "create" | "command" | "thinking" | "planning";
  name: string;
  path?: string;
  status: "pending" | "in_progress" | "completed" | "error";
  duration?: number;
  preview?: string;
}

interface AIProcessVisualizationProps {
  actions: ActionItem[];
  isProcessing: boolean;
  thinking?: string;
  plan?: string;
}

export function AIProcessVisualization({
  actions,
  isProcessing,
  thinking,
  plan,
}: AIProcessVisualizationProps) {
  const [completedCount, setCompletedCount] = useState(0);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  useEffect(() => {
    setCompletedCount(actions.filter((a) => a.status === "completed").length);
  }, [actions]);

  const fileActions = actions.filter(a => a.type === "read" || a.type === "write" || a.type === "create");
  const latestFileAction = fileActions[fileActions.length - 1];

  const getIcon = (type: string) => {
    switch (type) {
      case "read":
        return <Eye className="w-4 h-4 text-blue-500" />;
      case "write":
        return <Edit3 className="w-4 h-4 text-amber-500" />;
      case "create":
        return <Plus className="w-4 h-4 text-green-500" />;
      case "command":
        return <Terminal className="w-4 h-4 text-purple-500" />;
      case "thinking":
        return <Lightbulb className="w-4 h-4 text-yellow-500" />;
      case "planning":
        return <MapPin className="w-4 h-4 text-indigo-500" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case "read":
        return "Reading";
      case "write":
        return "Writing";
      case "create":
        return "Creating";
      case "command":
        return "Running";
      case "thinking":
        return "Thinking";
      case "planning":
        return "Planning";
      default:
        return "Processing";
    }
  };

  const getActionColor = (type: string, status: string) => {
    if (status === "completed") return "from-green-400 to-emerald-500";
    if (status === "in_progress") return "from-blue-400 to-cyan-500";
    if (status === "error") return "from-red-400 to-rose-500";
    
    switch (type) {
      case "read": return "from-blue-400 to-blue-500";
      case "write": return "from-amber-400 to-orange-500";
      case "create": return "from-green-400 to-emerald-500";
      case "command": return "from-purple-400 to-violet-500";
      default: return "from-gray-400 to-gray-500";
    }
  };

  return (
    <div className="space-y-4">
      {/* Plan */}
      {plan && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200/60 dark:border-indigo-800/60 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mb-2">
                План работы
              </p>
              <p className="text-sm text-indigo-600 dark:text-indigo-400 leading-relaxed whitespace-pre-wrap break-words">
                {plan}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Thinking */}
      {thinking && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-50/80 to-orange-50/80 dark:from-yellow-950/40 dark:to-orange-950/40 border border-yellow-200/60 dark:border-yellow-800/60 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <Loader2 className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0 animate-spin" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-yellow-700 dark:text-yellow-300 mb-2">
                Размышление
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-400 leading-relaxed whitespace-pre-wrap break-words">
                {thinking}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current File Operation - Large Display */}
      {latestFileAction && (
        <div className={cn(
          "p-5 rounded-xl border-2 backdrop-blur-sm transition-all duration-300",
          latestFileAction.status === "completed"
            ? "bg-gradient-to-r from-green-50/80 to-emerald-50/80 dark:from-green-950/40 dark:to-emerald-950/40 border-green-300/60 dark:border-green-700/60"
            : latestFileAction.status === "in_progress"
              ? "bg-gradient-to-r from-blue-50/80 to-cyan-50/80 dark:from-blue-950/40 dark:to-cyan-950/40 border-blue-300/60 dark:border-blue-700/60 animate-pulse"
              : "bg-gradient-to-r from-gray-50/80 to-slate-50/80 dark:from-gray-950/40 dark:to-slate-950/40 border-gray-300/60 dark:border-gray-700/60"
        )}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
                `bg-gradient-to-br ${getActionColor(latestFileAction.type, latestFileAction.status)} shadow-lg`
              )}>
                {latestFileAction.status === "completed" && (
                  <CheckCircle className="w-6 h-6 text-white" />
                )}
                {latestFileAction.status === "in_progress" && (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                )}
                {latestFileAction.status === "error" && (
                  <AlertCircle className="w-6 h-6 text-white" />
                )}
                {latestFileAction.status === "pending" && (
                  getIcon(latestFileAction.type)
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-gray-900 dark:text-white mb-1">
                  {getLabel(latestFileAction.type)} файла
                </p>
                {latestFileAction.path && (
                  <div className="flex items-center gap-2 mb-2">
                    <Code2 className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    <code className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-black/10 dark:bg-white/10 px-2 py-1 rounded break-all">
                      {latestFileAction.path}
                    </code>
                  </div>
                )}
                {latestFileAction.preview && (
                  <div className="mt-3 p-3 bg-black/5 dark:bg-white/5 rounded-lg border border-black/10 dark:border-white/10 max-h-[200px] overflow-y-auto">
                    <p className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                      {latestFileAction.preview}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {actions.length > 0 && (
        <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="w-full h-3 rounded-full bg-blue-200/50 dark:bg-blue-800/50 overflow-hidden border border-blue-300/50 dark:border-blue-700/50">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 transition-all duration-300 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                  style={{
                    width: `${(completedCount / actions.length) * 100}%`,
                  }}
                />
              </div>
            </div>
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {completedCount}/{actions.length}
            </span>
          </div>
        </div>
      )}

      {/* Actions Timeline */}
      {actions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-1">
            История действий
          </p>
          {actions.map((action, index) => (
            <div
              key={action.id}
              onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}
              className="cursor-pointer"
            >
              <div
                className={cn(
                  "p-3 rounded-lg border transition-all duration-300",
                  action.status === "completed"
                    ? "bg-green-50/50 dark:bg-green-950/30 border-green-200/50 dark:border-green-800/50 hover:bg-green-100/50 dark:hover:bg-green-950/50"
                    : action.status === "in_progress"
                      ? "bg-blue-50/50 dark:bg-blue-950/30 border-blue-200/50 dark:border-blue-800/50 animate-pulse hover:bg-blue-100/50 dark:hover:bg-blue-950/50"
                      : action.status === "error"
                        ? "bg-red-50/50 dark:bg-red-950/30 border-red-200/50 dark:border-red-800/50 hover:bg-red-100/50 dark:hover:bg-red-950/50"
                        : "bg-gray-50/50 dark:bg-gray-900/30 border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-100/50 dark:hover:bg-gray-900/50"
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {action.status === "completed" && (
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    )}
                    {action.status === "in_progress" && (
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    )}
                    {action.status === "error" && (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    {action.status === "pending" && (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-400 flex items-center justify-center">
                        {getIcon(action.type)}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        {getLabel(action.type)}
                      </span>
                      {action.path && (
                        <code className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded truncate">
                          {action.path}
                        </code>
                      )}
                    </div>
                    {action.name && action.name !== action.path && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {action.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
