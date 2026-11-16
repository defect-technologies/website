"use client";

import { Crosshair, FrameCorners, X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { NoteAnchor } from "@/lib/review";
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
        {anchor ? <span className="text-ink font-medium">{anchor.text || (anchor.tag ? `<${anchor.tag}>` : anchor.selector)}</span> : "Whole page"}
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

/** A key the founder can press instead of the button. */
export function Key({ children }: { children: ReactNode }) {
  return <kbd className="bg-ink/8 text-ink-soft hidden min-w-5 rounded px-1 text-center font-sans text-xs font-medium lg:inline-block">{children}</kbd>;
}
