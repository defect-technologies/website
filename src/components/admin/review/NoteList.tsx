"use client";

import { Trash } from "@phosphor-icons/react";
import { MAX_NOTE_TEXT, type NoteScope, type ReviewNote } from "@/lib/review";
import { NoteNumber, NoteTarget, ScopeToggle } from "./NoteParts";

type Props = {
  notes: ReviewNote[];
  onChange: (id: string, change: Partial<Pick<ReviewNote, "text" | "scope">>) => void;
  onRemove: (id: string) => void;
};

function NoteCard({ note, number, onChange, onRemove }: { note: ReviewNote; number: number } & Omit<Props, "notes">) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <NoteNumber value={number} />
        <NoteTarget anchor={note.anchor} path={note.path} />
      </div>
      <label htmlFor={`note-${note.id}`} className="sr-only">
        Note {number}
      </label>
      <textarea
        id={`note-${note.id}`}
        value={note.text}
        maxLength={MAX_NOTE_TEXT}
        onChange={(event) => onChange(note.id, { text: event.target.value })}
        rows={1}
        className="hover:bg-paper-shade/60 focus-visible:bg-surface focus-visible:outline-ink/20 -mx-2 field-sizing-content resize-none rounded-lg px-2 py-1 text-base text-pretty focus-visible:outline-2"
      />
      <div className="flex items-center justify-between gap-2">
        <ScopeToggle scope={note.scope} onChange={(scope: NoteScope) => onChange(note.id, { scope })} />
        <button
          type="button"
          onClick={() => onRemove(note.id)}
          aria-label={`Remove note ${number}`}
          className="text-ink-faint hover:text-bad hover:bg-bad/8 focus-visible:outline-ink grid size-9 place-items-center rounded-full transition-colors duration-150 focus-visible:outline-2"
        >
          <Trash size={18} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

/** The notes written so far, each editable until they're sent. */
export default function NoteList({ notes, onChange, onRemove }: Props) {
  return (
    <ol className="divide-ink/8 flex flex-col divide-y">
      {notes.map((note, index) => (
        <NoteCard key={note.id} note={note} number={index + 1} onChange={onChange} onRemove={onRemove} />
      ))}
    </ol>
  );
}
