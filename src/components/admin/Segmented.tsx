"use client";

import type { Icon } from "@phosphor-icons/react";

export type Segment<Value extends string> = { value: Value; label: string; icon?: Icon };

type Props<Value extends string> = { label: string; options: Segment<Value>[]; value: Value; onChange: (value: Value) => void };

/** A row of choices where exactly one is on: the width of a preview, which picture of a repair the stage shows, or which design is in view. */
export default function Segmented<Value extends string>({ label, options, value, onChange }: Props<Value>) {
  return (
    <div role="group" aria-label={label} className="bg-paper-shade flex w-fit rounded-full p-1">
      {options.map(({ value: option, label: name, icon: OptionIcon }) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`focus-visible:outline-ink inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-2 ${value === option ? "bg-surface text-ink shadow-card" : "text-ink-soft hover:text-ink"}`}
        >
          {OptionIcon && <OptionIcon size={18} weight={value === option ? "fill" : "regular"} aria-hidden="true" />}
          {name}
        </button>
      ))}
    </div>
  );
}
