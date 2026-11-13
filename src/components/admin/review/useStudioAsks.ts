"use client";

import { useAskFlow } from "./useAskFlow";
import { useReviewAsks } from "./useReviewAsks";
import { useStudioDevice } from "./useStudioDevice";

type Options = { businessId: string; previewUrl: string; nextId: string | null; onLastAnswer: () => void };

/**
 * The preview's questions, the founder's place among them, and the width the preview is shown at. openQuestion is the
 * current one when it is a free question; a critic's proposal and a repaired note are answered with their two buttons
 * only, so they are never open.
 */
export function useStudioAsks({ businessId, previewUrl, nextId, onLastAnswer }: Options) {
  const asks = useReviewAsks(businessId, previewUrl, nextId);
  const flow = useAskFlow(asks.asks, onLastAnswer);
  const currentAsk = flow.current;
  const openQuestion = currentAsk?.proposal || currentAsk?.repair ? null : currentAsk;
  const [device, setDevice] = useStudioDevice(currentAsk?.proposal?.device ?? currentAsk?.repair?.device ?? null, currentAsk?.id ?? null);
  return { asks, flow, currentAsk, openQuestion, device, setDevice };
}
