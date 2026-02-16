"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";

export type SelectOption = {
  value: string;
  label: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  color?: string;
  description?: string;
  disabled?: boolean;
};

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  size?: "sm" | "md";
  align?: "left" | "right";
  className?: string;
  disabled?: boolean;
}

const sizeStyles: Record<NonNullable<SelectProps["size"]>, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-9 px-3 text-sm",
};

export default function Select({
  value,
  onChange,
  options,
  placeholder = "Select",
  size = "md",
  align = "left",
  className = "",
  disabled = false,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) || null;
  const SelectedIcon = selected?.icon;

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled ? setOpen((prev) => !prev) : undefined}
        className={`
          inline-flex items-center gap-2 rounded-md border border-border bg-surface
          text-text-primary transition-colors
          hover:bg-background focus:outline-none focus:ring-2 focus:ring-secondary/30
          ${sizeStyles[size]}
          ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
        `}
        aria-haspopup="listbox"
        aria-expanded={open && !disabled}
      >
        {selected?.color && (
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selected.color }} />
        )}
        {SelectedIcon && (
          <span className="text-text-secondary">
            <SelectedIcon size={14} />
          </span>
        )}
        <span className="truncate">
          {selected ? selected.label : placeholder}
        </span>
        <CaretDown size={14} className="text-text-secondary" />
      </button>

      {open && (
        <div
          role="listbox"
          className={`
            absolute z-40 mt-1 min-w-[200px] rounded-md border border-border
            bg-surface py-1 shadow-lg
            ${align === "right" ? "right-0" : "left-0"}
            ${disabled ? "pointer-events-none opacity-50" : "pointer-events-auto"}
          `}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            const Icon = option.icon;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled || disabled}
                onClick={() => {
                  if (option.disabled || disabled) return;
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`
                  group flex w-full items-center gap-3 px-3 py-2 text-left text-sm
                  transition-colors cursor-pointer
                  ${option.disabled || disabled ? "cursor-not-allowed opacity-50" : "hover:bg-background"}
                `}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {option.color && (
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color }} />
                  )}
                  {Icon && (
                    <span className="text-text-secondary group-hover:text-text-primary">
                      <Icon size={16} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-text-primary">{option.label}</div>
                    {option.description && (
                      <div className="truncate text-xs text-text-secondary">
                        {option.description}
                      </div>
                    )}
                  </div>
                </div>
                {isSelected && <Check size={16} className="text-secondary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
