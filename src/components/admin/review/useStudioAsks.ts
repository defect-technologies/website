"use client";

import { useAskFlow } from "./useAskFlow";
import { useReviewAsks } from "./useReviewAsks";
import { useStudioDevice } from "./useStudioDevice";

type Options = { businessId: string; previewUrl: string; nextId: string | null; onLastAnswer: () => void };

/**
 * The preview's questions, the founder's place among them, and the width the preview is shown at. openQuestion is the
 * current one when it is a free question; a critic's proposal is answered with Yes or No only, so it is never open.
 */
export function useStudioAsks({ businessId, previewUrl, nextId, onLastAnswer }: Options) {
  const asks = useReviewAsks(businessId, previewUrl, nextId);
  const flow = useAskFlow(asks.asks, onLastAnswer);
  const currentAsk = flow.current;
  const openQuestion = currentAsk?.proposal ? null : currentAsk;
  const [device, setDevice] = useStudioDevice(currentAsk?.proposal?.device ?? null, currentAsk?.id ?? null);
  return { asks, flow, currentAsk, openQuestion, device, setDevice };
}
