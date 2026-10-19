import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export const controlClasses = cn(
  "min-h-11 w-full min-w-0 rounded-control border border-border bg-elevated px-3 py-2 text-base text-foreground placeholder:text-muted/70 transition-colors duration-150 ease-standard",
  "hover:border-border-strong focus:border-primary/70 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  "disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-negative sm:text-sm"
);

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClasses, className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClasses, className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(controlClasses, "min-h-28 resize-y", className)} {...props} />
  );
}

export function Field({
  label,
  hint,
  error,
  className,
  labelClassName,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  labelClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span
          className={cn(
            "text-2xs font-semibold uppercase tracking-wide text-muted",
            labelClassName
          )}
        >
          {label}
        </span>
        {children}
      </label>
      {error ? (
        <p className="text-2xs font-medium text-negative">{error}</p>
      ) : hint ? (
        <p className="text-2xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
