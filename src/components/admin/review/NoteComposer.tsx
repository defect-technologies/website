"use client";

import { Crosshair, Microphone, Plus } from "@phosphor-icons/react";
import type { RefObject } from "react";
import type { BridgeState } from "@/hooks/useReviewBridge";
import { MAX_NOTE_TEXT } from "@/lib/review";
import { Button } from "../../Button";
import { Key, NoteTarget, ScopeToggle } from "./NoteParts";
import type { Draft } from "./reviewDraft";

type Dictation = { supported: boolean; listening: boolean; interim: string; error: string; toggle: () => void };

type Props = {
  field: RefObject<HTMLTextAreaElement | null>;
  draft: Draft;
  path: string;
  bridge: BridgeState;
  pointing: boolean;
  dictation: Dictation;
  onDraft: (draft: Draft) => void;
  onPoint: () => void;
  onAdd: () => void;
};

const TOOL = "focus-visible:outline-ink inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-[background-color,color,scale,box-shadow] duration-150 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-45 disabled:pointer-events-none";
const TOOL_ON = "bg-ink text-paper shadow-[0_0_0_3px_rgb(226_66_27/0.35)]";
const TOOL_OFF = "bg-paper-shade text-ink hover:bg-paper-shade/70";

function PointButton({ on, bridge, onPoint }: { on: boolean; bridge: BridgeState; onPoint: () => void }) {
  return (
    <button type="button" aria-pressed={on} disabled={bridge !== "connected"} onClick={onPoint} className={`${TOOL} ${on ? TOOL_ON : TOOL_OFF}`}>
      <Crosshair size={18} weight={on ? "bold" : "regular"} aria-hidden="true" />
      Point at it
      <Key>P</Key>
    </button>
  );
}

function TalkButton({ dictation }: { dictation: Dictation }) {
  if (!dictation.supported) return null;
  const on = dictation.listening;
  return (
    <button type="button" aria-pressed={on} onClick={dictation.toggle} className={`${TOOL} ${on ? TOOL_ON : TOOL_OFF}`}>
      {on ? <Microphone size={18} weight="fill" aria-hidden="true" className="motion-safe:animate-pulse" /> : <Microphone size={18} aria-hidden="true" />}
      {on ? "Listening" : "Talk"}
      <Key>M</Key>
    </button>
  );
}

function BridgeHint({ bridge }: { bridge: BridgeState }) {
  if (bridge !== "unavailable") return null;
  return <p className="text-ink-faint text-sm text-pretty">This preview was built before pointing worked, so say which part you mean. Its next build adds pointing.</p>;
}

/**
 * Where a note is written: point at an element in the frame, then type or talk. With both on, every new click starts
 * the next note, so a founder can talk through a page without touching the keyboard.
 */
export default function NoteComposer({ field, draft, path, bridge, pointing, dictation, onDraft, onPoint, onAdd }: Props) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <NoteTarget anchor={draft.anchor} path={path} onClear={draft.anchor ? () => onDraft({ ...draft, anchor: null, pickedOn: null }) : undefined} />
      <label htmlFor="review-draft" className="sr-only">
        New note
      </label>
      <textarea
        id="review-draft"
        ref={field}
        value={draft.text}
        maxLength={MAX_NOTE_TEXT}
        rows={3}
        placeholder={pointing ? "Click something in the preview, then say what's wrong" : "What should change?"}
        onChange={(event) => onDraft({ ...draft, text: event.target.value })}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey) return;
          event.preventDefault();
          onAdd();
        }}
        className="bg-surface border-ink/15 placeholder:text-ink-faint focus-visible:border-ink focus-visible:outline-ink/20 field-sizing-content max-h-48 min-h-20 w-full resize-none rounded-lg border px-3 py-2 text-base focus-visible:outline-2"
      />
      <p aria-live="polite" className="text-ink-faint min-h-5 text-sm">
        {dictation.error || dictation.interim}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <PointButton on={pointing} bridge={bridge} onPoint={onPoint} />
        <TalkButton dictation={dictation} />
        <ScopeToggle scope={draft.scope} onChange={(scope) => onDraft({ ...draft, scope })} />
        <Button size="sm" variant="ghost" className="ml-auto" disabled={!draft.text.trim()} onClick={onAdd} icon={<Plus size={16} weight="bold" aria-hidden="true" />}>
          Add
        </Button>
      </div>
      <BridgeHint bridge={bridge} />
    </div>
  );
}
