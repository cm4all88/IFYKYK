import { clsx } from "clsx";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-text-sec uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={clsx(
          "w-full bg-surface-alt border rounded-xl px-4 py-3 text-sm text-text placeholder:text-text-mute",
          "outline-none transition-colors",
          error ? "border-red-500 focus:border-red-500" : "border-border focus:border-amber",
          className
        )}
        {...props}
      />
      {hint && !error && <p className="text-xs text-text-mute">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
