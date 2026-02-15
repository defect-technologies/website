"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full rounded-md border border-border bg-surface px-3 py-2 text-sm
            text-text-primary placeholder:text-text-secondary/50
            focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? "border-error focus:ring-error/30 focus:border-error" : ""}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
