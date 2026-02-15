"use client";

import { forwardRef, useRef, useEffect, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  maxChars?: number;
  charCount?: number;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, maxChars, charCount, className = "", id, onChange, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    const setRefs = (el: HTMLTextAreaElement | null) => {
      internalRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    };

    useEffect(() => {
      const el = internalRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }, [props.value]);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <textarea
          ref={setRefs}
          id={inputId}
          onChange={onChange}
          className={`
            w-full rounded-md border border-border bg-surface px-3 py-2 text-sm
            text-text-primary placeholder:text-text-secondary/50 resize-none
            focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary
            disabled:opacity-50 disabled:cursor-not-allowed min-h-[80px]
            ${error ? "border-error focus:ring-error/30 focus:border-error" : ""}
            ${className}
          `}
          {...props}
        />
        <div className="flex justify-between">
          {error && <p className="text-xs text-error">{error}</p>}
          {maxChars != null && (
            <p className={`text-xs ml-auto ${(charCount ?? 0) > maxChars ? "text-error" : "text-text-secondary"}`}>
              {charCount ?? 0}/{maxChars}
            </p>
          )}
        </div>
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
export default Textarea;
