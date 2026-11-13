"use client";

import { Microphone, Stop } from "@phosphor-icons/react";
import { useState } from "react";
import { appendPhrase, useDictation } from "@/hooks/useDictation";
import { MAX_NOTE_TEXT } from "@/lib/review";
import { Button } from "../../Button";

/** What should change in the chosen design, typed or said. It is the form's `feedback` field. */
export default function FeedbackField() {
  const [text, setText] = useState("");
  const dictation = useDictation((phrase) => setText((current) => appendPhrase(current, phrase)));
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <label htmlFor="board-feedback" className="text-sm font-medium">
        What should change in the one you choose?
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id="board-feedback"
          name="feedback"
          rows={2}
          maxLength={MAX_NOTE_TEXT}
          value={dictation.listening ? `${text} ${dictation.interim}`.trim() : text}
          readOnly={dictation.listening}
          onChange={(event) => setText(event.target.value)}
          className="bg-surface border-ink/15 focus-visible:border-ink focus-visible:outline-ink/20 field-sizing-content max-h-40 min-w-0 flex-1 resize-none rounded-lg border px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-0"
        />
        {dictation.supported && (
          <Button variant={dictation.listening ? "solid" : "soft"} aria-pressed={dictation.listening} onClick={dictation.toggle} icon={dictation.listening ? <Stop size={18} weight="fill" aria-hidden="true" /> : <Microphone size={18} aria-hidden="true" />}>
            {dictation.listening ? "Done talking" : "Talk"}
          </Button>
        )}
      </div>
      {dictation.error && (
        <p role="alert" className="text-bad text-sm font-medium">
          {dictation.error}
        </p>
      )}
    </div>
  );
}
