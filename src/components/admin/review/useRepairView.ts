"use client";

import { useState } from "react";
import { DEVICE_WIDTH } from "@/lib/review";
import type { ReviewAsk, RepairView } from "@/lib/reviewAsks";

const ALT: Record<Exclude<RepairView, "live">, string> = {
  before: "The part of the page this note is about, before the repair",
  after: "The part of the page this note is about, after the repair",
};

/**
 * Which view of a repaired note the stage shows. Every note starts on its picture from after the repair, so the two
 * pictures change places without the page moving; the live preview is there to try the page.
 */
export function useRepairView(ask: ReviewAsk | null) {
  const [chosen, setChosen] = useState<{ askId: string; view: RepairView } | null>(null);
  const repair = ask?.repair ?? null;
  const view: RepairView = chosen && chosen.askId === ask?.id ? chosen.view : "after";
  const setView = (next: RepairView) => ask && setChosen({ askId: ask.id, view: next });
  const src = repair && view !== "live" ? repair[view] : "";
  const picture = repair && src && view !== "live" ? { src, alt: ALT[view], width: DEVICE_WIDTH[repair.device], focus: repair.focus ?? 0 } : null;
  return { view, setView, picture };
}
