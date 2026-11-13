"use client";

import type { ReviewNote } from "@/lib/review";
import type { ReviewAsk } from "@/lib/reviewAsks";
import { noteFromRepair } from "./reviewDraft";
import type { AskFlow } from "./useAskFlow";

/** Fixed moves on. Still wrong puts the note back among the founder's notes, for the next repair, and moves on. */
export function useRepairAnswer(ask: ReviewAsk | null, flow: AskFlow, add: (note: ReviewNote) => void) {
  return (fixed: boolean) => {
    if (!ask?.repair) return;
    if (fixed) return flow.good();
    const note = noteFromRepair(ask);
    if (note) add(note);
    flow.noted();
  };
}
