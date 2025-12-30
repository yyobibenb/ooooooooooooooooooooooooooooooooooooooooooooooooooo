import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hoverEffect = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "glass-panel rounded-xl p-6 transition-all duration-300",
          hoverEffect && "hover:bg-white/[0.05] hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
GlassCard.displayName = "GlassCard";

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant = "primary", isLoading, icon, children, disabled, ...props }, ref) => {
    const variants = {
      primary: "bg-blue-600/20 border-blue-400/30 text-blue-100 hover:bg-blue-600/30 hover:border-blue-400/50 hover:shadow-blue-900/20",
      secondary: "bg-white/5 border-white/10 text-white hover:bg-white/10",
      danger: "bg-red-500/10 border-red-500/20 text-red-200 hover:bg-red-500/20 hover:border-red-500/40",
      ghost: "bg-transparent border-transparent hover:bg-white/5 text-gray-400 hover:text-white"
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "glass-button inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          icon && <span className="mr-2">{icon}</span>
        )}
        {children}
      </button>
    );
  }
);
GlassButton.displayName = "GlassButton";

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn("glass-input w-full", className)}
        {...props}
      />
    );
  }
);
GlassInput.displayName = "GlassInput";
