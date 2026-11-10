"use client";

import { CaretRight, ListBullets, X } from "@phosphor-icons/react";
import Link from "next/link";

type Props = {
  item: { businessName: string };
  position: number;
  total: number;
  nextId: string | null;
  notes: number;
  notesOpen: boolean;
  onNotes: () => void;
};

const PILL = "bg-paper/95 text-ink shadow-lifted backdrop-blur pointer-events-auto flex min-h-11 items-center rounded-full";
const ROUND = "grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-ink";

/** Floats over the full-screen preview on a phone: which business, where in the queue, the notes, and the next one. */
export default function PhoneTopBar({ item, position, total, nextId, notes, notesOpen, onNotes }: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
      <div className={`${PILL} min-w-0 pr-4`}>
        <Link href="/admin" className={ROUND}>
          <X size={18} aria-hidden="true" />
          <span className="sr-only">Close review and go back to Today</span>
        </Link>
        <h1 className="min-w-0 truncate text-sm font-semibold">{item.businessName}</h1>
        <span className="text-ink-faint ml-2 shrink-0 text-sm tabular-nums">
          {position}/{total}
        </span>
      </div>
      <div className={`${PILL} shrink-0`}>
        <button type="button" onClick={onNotes} aria-expanded={notesOpen} className={`${ROUND} relative ${notesOpen ? "bg-ink text-paper" : ""}`}>
          <ListBullets size={18} aria-hidden="true" />
          <span className="sr-only">{notesOpen ? "Hide your notes" : "Show your notes"}</span>
          {notes > 0 && <span className="bg-vermilion text-paper absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs font-semibold tabular-nums">{notes}</span>}
        </button>
        {nextId && (
          <Link href={`/admin/review?id=${nextId}`} className={ROUND}>
            <CaretRight size={18} weight="bold" aria-hidden="true" />
            <span className="sr-only">Skip to the next preview</span>
          </Link>
        )}
      </div>
    </div>
  );
}
