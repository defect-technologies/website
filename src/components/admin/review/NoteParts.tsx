"use client";

import { Check, Crosshair, FrameCorners, GlobeHemisphereWest, X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { NoteAnchor, NoteScope } from "@/lib/review";
import KnifeStroke from "../KnifeStroke";

/** A note's number on a swipe of the knife, the admin's mark for "here". */
export function NoteNumber({ value }: { value: number }) {
  return (
    <span className="relative isolate grid h-7 w-9 shrink-0 place-items-center text-sm font-semibold tabular-nums">
      <KnifeStroke variant={value} className="text-vermilion/30 absolute inset-0 -z-10 size-full" />
      {value}
    </span>
  );
}

/** What a note points at: the element's own words and its page, or the whole page. */
export function NoteTarget({ anchor, path, onClear }: { anchor: NoteAnchor | null; path: string; onClear?: () => void }) {
  const TargetIcon = anchor ? Crosshair : FrameCorners;
  return (
    <span className="text-ink-soft flex min-w-0 items-center gap-1.5 text-sm">
      <TargetIcon size={16} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 truncate" title={anchor ? `${anchor.selector} on ${anchor.path}` : undefined}>
        {anchor ? <span className="text-ink font-medium">{anchor.text || `<${anchor.tag}>`}</span> : "Whole page"}
        <span className="text-ink-faint"> on {anchor?.path ?? path}</span>
      </span>
      {onClear && (
        <button type="button" onClick={onClear} aria-label="Stop pointing at this element" className="text-ink-faint hover:text-ink hover:bg-paper-shade focus-visible:outline-ink -my-1 grid size-7 shrink-0 place-items-center rounded-full focus-visible:outline-2">
          <X size={14} weight="bold" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/** "Every site" also turns the note into a taste lesson that every later build has to follow. */
export function ScopeToggle({ scope, onChange }: { scope: NoteScope; onChange: (scope: NoteScope) => void }) {
  const every = scope === "every";
  return (
    <button
      type="button"
      aria-pressed={every}
      onClick={() => onChange(every ? "site" : "every")}
      title="Also teach this to every site the builder makes from now on"
      className={`focus-visible:outline-ink inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-[background-color,color,scale] duration-150 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 ${every ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-shade hover:text-ink"}`}
    >
      {every ? <Check size={16} weight="bold" aria-hidden="true" /> : <GlobeHemisphereWest size={16} aria-hidden="true" />}
      Every site
    </button>
  );
}

/** A key the founder can press instead of the button. */
export function Key({ children }: { children: ReactNode }) {
  return <kbd className="bg-ink/8 text-ink-soft hidden min-w-5 rounded px-1 text-center font-sans text-xs font-medium lg:inline-block">{children}</kbd>;
}
