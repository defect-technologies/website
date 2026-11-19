"use client";

import { useState } from "react";
import type { Device, ReviewNote } from "@/lib/review";
import { useCloseOnTouchElsewhere } from "../dock";
import { type Draft, EMPTY_DRAFT, noteFromDraft } from "./reviewDraft";
import { useStudio } from "./StudioContext";

type Dictation = { listening: boolean; interim: string; toggle: () => void; stop: () => void };

type Options = {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  dictation: Dictation;
  add: (note: ReviewNote) => void;
  device: Device;
  path: string;
  confirming: boolean;
  setConfirming: (confirming: boolean) => void;
  submit: () => void;
  /** The open question, if any: talking answers it instead of asking to send. */
  ask: { open: boolean; answered: () => void };
};

/**
 * The phone flow: talking ends with a tap on the mic, Claude splits what was said into notes (all pointing where the
 * draft pointed), and the dock then asks whether to send them.
 */
export function usePhoneReview({ draft, setDraft, dictation, add, device, path, confirming, setConfirming, submit, ask }: Options) {
  const [splitting, setSplitting] = useState(false);
  const { splitSpoken } = useStudio().actions;
  useCloseOnTouchElsewhere(confirming, () => setConfirming(false));

  const finishTalking = async () => {
    const spoken = `${draft.text} ${dictation.interim}`.trim();
    dictation.stop();
    if (!spoken) return;
    setSplitting(true);
    const notes = await splitSpoken(spoken);
    setSplitting(false);
    for (const note of notes) add(noteFromDraft({ ...draft, text: note.text }, device, path, { kind: note.kind, target: note.target }));
    setDraft({ ...EMPTY_DRAFT });
    if (!notes.length) return;
    if (ask.open) ask.answered();
    else setConfirming(true);
  };

  const toggleTalk = () => {
    setConfirming(false);
    if (dictation.listening) void finishTalking();
    else dictation.toggle();
  };

  const confirm = () => {
    setConfirming(false);
    submit();
  };

  return { splitting, toggleTalk, askToSend: () => setConfirming(true), confirm, cancel: () => setConfirming(false) };
}
