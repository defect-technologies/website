"use client";

import { useEffect, useRef } from "react";
import type { BridgeState } from "@/hooks/useReviewBridge";
import { type ReviewAsk, samePage } from "@/lib/reviewAsks";

type Bridge = { state: BridgeState; path: string; show: (target: { path: string; selector: string; question: string }) => void };

/**
 * A new question takes the preview to its element. Once there, the element is marked again whenever the founder comes
 * back to that page, but wandering off to another page never pulls them back.
 */
export function useShowAsk(bridge: Bridge, ask: ReviewAsk | null) {
  const shownAsk = useRef<string | null>(null);
  const { state, show } = bridge;
  const onAskPage = Boolean(ask) && samePage(bridge.path, ask?.path ?? "");
  useEffect(() => {
    if (state !== "connected" || !ask?.selector) return;
    if (shownAsk.current === ask.id && !onAskPage) return;
    shownAsk.current = ask.id;
    show(ask);
  }, [state, show, ask, onAskPage]);
}
