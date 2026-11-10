"use client";

import { useEffect, useState } from "react";
import { reviewAsksAction } from "@/app/admin/(panel)/review/studioActions";
import type { ReviewAsk } from "@/lib/reviewAsks";

export type AsksState = { status: "loading" | "ready" | "none"; asks: ReviewAsk[] };

/** v2: questions became a few words each, so the long ones saved before are written again. */
const keyOf = (businessId: string, previewUrl: string) => `review-asks-v2:${businessId}:${previewUrl}`;

function readCached(businessId: string, previewUrl: string): ReviewAsk[] | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(keyOf(businessId, previewUrl)) ?? "null");
    return Array.isArray(saved) && saved.length ? saved : null;
  } catch {
    return null;
  }
}

function cache(businessId: string, previewUrl: string, asks: ReviewAsk[]) {
  if (!previewUrl || !asks.length) return;
  try {
    window.localStorage.setItem(keyOf(businessId, previewUrl), JSON.stringify(asks));
  } catch {
    // Private windows can refuse storage; the questions still show for this visit.
  }
}

/** Writes the next preview's questions into this browser while the founder answers this one's. */
function prepareNext(nextId: string | null) {
  if (!nextId) return;
  void reviewAsksAction(nextId).then(({ previewUrl, asks }) => {
    if (!readCached(nextId, previewUrl)) cache(nextId, previewUrl, asks);
  });
}

/** This preview's questions: from this browser when they were written before, otherwise from Claude now. */
export function useReviewAsks(businessId: string, previewUrl: string, nextId: string | null): AsksState {
  const [state, setState] = useState<AsksState>(() => {
    const cached = readCached(businessId, previewUrl);
    return cached ? { status: "ready", asks: cached } : { status: "loading", asks: [] };
  });
  const needsWriting = state.status === "loading";

  useEffect(() => {
    if (!needsWriting) {
      prepareNext(nextId);
      return;
    }
    let current = true;
    void reviewAsksAction(businessId).then(({ previewUrl: written, asks }) => {
      if (!current) return;
      if (written === previewUrl) cache(businessId, previewUrl, asks);
      setState(written === previewUrl && asks.length ? { status: "ready", asks } : { status: "none", asks: [] });
      prepareNext(nextId);
    });
    return () => {
      current = false;
    };
  }, [businessId, previewUrl, nextId, needsWriting]);

  return state;
}
