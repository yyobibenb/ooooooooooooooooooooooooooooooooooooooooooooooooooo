import { FileText, Eye, Edit3, Plus, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileOperation {
  type: "read" | "write" | "create";
  path: string;
  status: "pending" | "in_progress" | "completed" | "error";
  preview?: string;
  error?: string;
}

interface FileOperationDisplayProps {
  operation: FileOperation;
}

export function FileOperationDisplay({ operation }: FileOperationDisplayProps) {
  const getIcon = () => {
    switch (operation.type) {
      case "read":
        return <Eye className="w-5 h-5" />;
      case "write":
        return <Edit3 className="w-5 h-5" />;
      case "create":
        return <Plus className="w-5 h-5" />;
    }
  };

  const getLabel = () => {
    switch (operation.type) {
      case "read":
        return "Читает";
      case "write":
        return "Редактирует";
      case "create":
        return "Создаёт";
    }
  };

  const getStatusColor = () => {
    if (operation.status === "completed") return "from-green-500 to-emerald-600";
    if (operation.status === "in_progress") return "from-blue-500 to-cyan-600";
    if (operation.status === "error") return "from-red-500 to-rose-600";
    return "from-gray-400 to-gray-500";
  };

  return (
    <div
      className={cn(
        "rounded-xl p-4 border-2 backdrop-blur-md transition-all duration-300 animate-slideUp",
        operation.status === "completed"
          ? "bg-gradient-to-br from-green-50/80 to-emerald-50/80 dark:from-green-950/50 dark:to-emerald-950/50 border-green-300/70 dark:border-green-700/70"
          : operation.status === "in_progress"
            ? "bg-gradient-to-br from-blue-50/80 to-cyan-50/80 dark:from-blue-950/50 dark:to-cyan-950/50 border-blue-300/70 dark:border-blue-700/70 animate-pulse"
            : operation.status === "error"
              ? "bg-gradient-to-br from-red-50/80 to-rose-50/80 dark:from-red-950/50 dark:to-rose-950/50 border-red-300/70 dark:border-red-700/70"
              : "bg-gradient-to-br from-gray-50/80 to-slate-50/80 dark:from-gray-950/50 dark:to-slate-950/50 border-gray-300/70 dark:border-gray-700/70"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={cn(
            "w-14 h-14 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-lg",
            `bg-gradient-to-br ${getStatusColor()}`
          )}
        >
          {operation.status === "completed" && <CheckCircle2 className="w-7 h-7" />}
          {operation.status === "in_progress" && (
            <Loader2 className="w-7 h-7 animate-spin" />
          )}
          {operation.status === "error" && <AlertCircle className="w-7 h-7" />}
          {operation.status === "pending" && getIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {getLabel()} файл
            </h3>
            {operation.status === "completed" && (
              <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100/50 dark:bg-green-900/50 px-2 py-1 rounded-full">
                Готово
              </span>
            )}
            {operation.status === "in_progress" && (
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/50 px-2 py-1 rounded-full animate-pulse">
                В процессе...
              </span>
            )}
            {operation.status === "error" && (
              <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-100/50 dark:bg-red-900/50 px-2 py-1 rounded-full">
                Ошибка
              </span>
            )}
          </div>

          {/* File Path */}
          <div className="mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
            <code className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200 bg-black/10 dark:bg-white/10 px-3 py-1 rounded-lg truncate">
              {operation.path}
            </code>
          </div>

          {/* Preview */}
          {operation.preview && operation.status !== "error" && (
            <div className="mb-3 p-3 bg-black/5 dark:bg-white/5 rounded-lg border border-black/10 dark:border-white/10 max-h-[300px] overflow-y-auto">
              <p className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                {operation.preview.length > 500
                  ? `${operation.preview.slice(0, 500)}...`
                  : operation.preview}
              </p>
            </div>
          )}

          {/* Error Message */}
          {operation.error && (
            <div className="p-3 bg-red-100/50 dark:bg-red-900/20 rounded-lg border border-red-200/50 dark:border-red-800/50">
              <p className="text-xs text-red-700 dark:text-red-400 font-mono break-words">
                {operation.error}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
