"use client";

import { useState } from "react";
import { splitSpokenNotesAction } from "@/app/admin/(panel)/review/studioActions";
import type { Device, ReviewNote } from "@/lib/review";
import { useStopOnTouch } from "../dock";
import { type Draft, EMPTY_DRAFT, noteFromDraft } from "./reviewDraft";

type Dictation = { listening: boolean; interim: string; toggle: () => void; stop: () => void };

type Options = {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  dictation: Dictation;
  add: (note: ReviewNote) => void;
  device: Device;
  path: string;
  count: number;
  armed: boolean;
  setArmed: (armed: boolean) => void;
  submit: () => void;
  /** The open question, if any: talking answers it instead of starting the countdown. */
  ask: { open: boolean; answered: () => void };
};

/**
 * The phone flow: talking ends with a tap on the mic, Claude splits what was said into notes (each for this site or
 * every site, all pointing where the draft pointed), and the notes then send themselves after a countdown.
 */
export function usePhoneReview({ draft, setDraft, dictation, add, device, path, count, armed, setArmed, submit, ask }: Options) {
  const [splitting, setSplitting] = useState(false);
  useStopOnTouch(armed, () => setArmed(false));

  const finishTalking = async () => {
    const spoken = `${draft.text} ${dictation.interim}`.trim();
    dictation.stop();
    if (!spoken) return;
    setSplitting(true);
    const notes = await splitSpokenNotesAction(spoken);
    setSplitting(false);
    for (const note of notes) add(noteFromDraft({ ...draft, text: note.text, scope: draft.scope === "every" ? "every" : note.scope }, device, path, { kind: note.kind, target: note.target }));
    setDraft({ ...EMPTY_DRAFT });
    if (!notes.length) return;
    if (ask.open) ask.answered();
    else setArmed(true);
  };

  const toggleTalk = () => {
    setArmed(false);
    if (dictation.listening) void finishTalking();
    else dictation.toggle();
  };

  /** Sending is immediate; approving with no notes starts the countdown first, and a second tap approves now. */
  const tapSend = () => {
    if (count || armed) {
      setArmed(false);
      submit();
      return;
    }
    setArmed(true);
  };

  return { splitting, toggleTalk, tapSend };
}
