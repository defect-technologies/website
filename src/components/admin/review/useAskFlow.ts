"use client";

import { useEffect, useRef, useState } from "react";
import type { ReviewAsk } from "@/lib/reviewAsks";

export type AskAnswer = "good" | "noted" | "skipped";

/** Walks the founder through the questions one at a time and calls onFinish after the last answer. */
export function useAskFlow(asks: ReviewAsk[], onFinish: () => void) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AskAnswer>>({});
  const finish = useRef(onFinish);
  useEffect(() => {
    finish.current = onFinish;
  });
  const current = asks[index] ?? null;

  const answer = (kind: AskAnswer) => {
    if (!current) return;
    setAnswers((all) => ({ ...all, [current.id]: kind }));
    setIndex(index + 1);
    if (index + 1 >= asks.length) finish.current();
  };

  return {
    current,
    index,
    answers,
    finished: asks.length > 0 && index >= asks.length,
    good: () => answer("good"),
    skip: () => answer("skipped"),
    noted: () => answer("noted"),
  };
}

export type AskFlow = ReturnType<typeof useAskFlow>;
