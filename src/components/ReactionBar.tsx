"use client";

import { useEffect, useRef, useState, useOptimistic, useTransition } from "react";
import { ThumbsUp, Heart, ThumbsDown } from "@phosphor-icons/react";
import type { ReactionCounts } from "@/types";

interface ReactionBarProps {
  postId: string;
  counts: ReactionCounts;
  userReaction?: string | null;
}

type ReactionType = "thumbsup" | "heart" | "thumbsdown";

const reactionConfig = [
  { type: "heart" as const, Icon: Heart, label: "Love" },
  { type: "thumbsup" as const, Icon: ThumbsUp, label: "Like" },
  { type: "thumbsdown" as const, Icon: ThumbsDown, label: "Dislike" },
];

export default function ReactionBar({ postId, counts: initialCounts, userReaction: initialReaction }: ReactionBarProps) {
  const [, startTransition] = useTransition();
  const [currentReaction, setCurrentReaction] = useState(initialReaction);
  const reactionRef = useRef<string | null>(initialReaction || null);
  const [baseCounts, setBaseCounts] = useState(initialCounts);
  const lastCountsRef = useRef(initialCounts);
  const [optimisticCounts, addOptimistic] = useOptimistic(
    baseCounts,
    (state: ReactionCounts, action: { type: keyof ReactionCounts; delta: number }) => ({
      ...state,
      [action.type]: Math.max(0, state[action.type] + action.delta),
    })
  );

  useEffect(() => {
    const last = lastCountsRef.current;
    if (
      last.thumbsup !== initialCounts.thumbsup
      || last.heart !== initialCounts.heart
      || last.thumbsdown !== initialCounts.thumbsdown
    ) {
      lastCountsRef.current = initialCounts;
      setBaseCounts(initialCounts);
    }
  }, [initialCounts]);

  useEffect(() => {
    const nextReaction = initialReaction || null;
    reactionRef.current = nextReaction;
    setCurrentReaction(nextReaction);
  }, [initialReaction]);

  function applyOptimisticChange(previous: ReactionType | null, next: ReactionType | null) {
    if (previous === next) return;
    if (previous && !next) {
      addOptimistic({ type: previous, delta: -1 });
      return;
    }
    if (!previous && next) {
      addOptimistic({ type: next, delta: 1 });
      return;
    }
    if (previous && next) {
      addOptimistic({ type: previous, delta: -1 });
      addOptimistic({ type: next, delta: 1 });
    }
  }

  async function toggleReaction(type: ReactionType) {
    const previous = reactionRef.current;
    const next = previous === type ? null : type;

    startTransition(() => {
      applyOptimisticChange(previous as ReactionType | null, next);

      reactionRef.current = next;
      setCurrentReaction(next);
    });

    try {
      const response = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, type }),
      });

      if (!response.ok) {
        startTransition(() => {
          applyOptimisticChange(next, previous as ReactionType | null);
          reactionRef.current = previous;
          setCurrentReaction(previous);
        });
      }
    } catch {
      startTransition(() => {
        applyOptimisticChange(next, previous as ReactionType | null);
        reactionRef.current = previous;
        setCurrentReaction(previous);
      });
    }
  }

  return (
    <div className="flex items-center gap-1">
      {reactionConfig.map(({ type, Icon, label }) => {
        const isActive = currentReaction === type;
        const count = optimisticCounts[type];

        return (
          <button
            key={type}
            onClick={(e) => {
              e.stopPropagation();
              toggleReaction(type);
            }}
            aria-label={label}
            className={`inline-flex items-center gap-1 rounded-full px-1 py-1 text-base font-medium transition-colors cursor-pointer ${
              isActive
                ? type === "thumbsdown"
                  ? "text-error"
                  : "text-accent"
                : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            }`}
          >
            <Icon size={16} weight={isActive ? "fill" : "regular"} />
            <span className="text-sm">{count > 0 ? count : " "}</span>
          </button>
        );
      })}
    </div>
  );
}
