import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/85",
  secondary:
    "border border-border bg-elevated text-foreground hover:border-border-strong hover:bg-elevated/80",
  ghost:
    "border border-transparent text-muted hover:bg-elevated hover:text-foreground",
  outline:
    "border border-border bg-transparent text-foreground hover:border-border-strong hover:bg-elevated",
  danger:
    "border border-negative/30 bg-negative/10 text-negative hover:border-negative/50 hover:bg-negative/15",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-10 px-3 text-xs",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-sm",
  icon: "h-10 w-10 p-0",
  "icon-lg": "h-11 w-11 p-0",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-semibold transition-colors duration-150 ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60",
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ref,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
