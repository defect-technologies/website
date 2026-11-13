"use client";

import { CaretLeft, CaretRight, Check } from "@phosphor-icons/react";
import type { CriticKind } from "@/lib/critics";
import type { ReviewNote } from "@/lib/review";
import { QUICK_NOTES, quickNoteOn } from "@/lib/reviewSections";
import type { SectionSteps } from "./useSectionSteps";

type Props = { steps: SectionSteps; notes: ReviewNote[]; onQuickNote: (kind: CriticKind) => void; className?: string };

const STEP = "bg-paper-shade text-ink hover:bg-paper-shade/70 focus-visible:outline-ink grid size-10 shrink-0 place-items-center rounded-full transition-[background-color,scale,opacity] duration-150 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-30";
const CHIP = "focus-visible:outline-ink inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-[background-color,color,scale] duration-150 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2";

/**
 * One section of the preview at a time, while pointing: step to the one before or after, and add any of the six usual
 * notes to it with a tap. A note that is on shows a check and comes off with a second tap. Talking or typing adds a
 * note in the founder's own words to the same section.
 */
export default function SectionCard({ steps, notes, onQuickNote, className = "" }: Props) {
  const { current, at, sections } = steps;
  if (!current) return null;
  return (
    <section aria-label="Section of this preview" className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={steps.previous} disabled={at === 0} className={STEP}>
          <CaretLeft size={18} weight="bold" aria-hidden="true" />
          <span className="sr-only">Section before</span>
        </button>
        <p aria-live="polite" className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="text-ink-soft shrink-0 text-sm tabular-nums">
            {at + 1} of {sections.length}
          </span>
          <span className="truncate text-base font-semibold">{steps.name}</span>
        </p>
        <button type="button" onClick={steps.next} disabled={at >= sections.length - 1} className={STEP}>
          <CaretRight size={18} weight="bold" aria-hidden="true" />
          <span className="sr-only">Section after</span>
        </button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {QUICK_NOTES.map((quick) => {
          const on = Boolean(quickNoteOn(notes, current, quick.kind));
          return (
            <li key={quick.kind}>
              <button type="button" aria-pressed={on} onClick={() => onQuickNote(quick.kind)} className={`${CHIP} ${on ? "bg-ink text-paper" : "bg-paper-shade text-ink hover:bg-paper-shade/70"}`}>
                {on && <Check size={14} weight="bold" aria-hidden="true" />}
                {quick.label}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
