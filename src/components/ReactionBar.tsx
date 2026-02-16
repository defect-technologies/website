"use client";

import { useState, useOptimistic, useTransition } from "react";
import { ThumbsUp, Heart, ThumbsDown } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import type { ReactionCounts } from "@/types";

interface ReactionBarProps {
  postId: string;
  counts: ReactionCounts;
  userReaction?: string | null;
}

const reactionConfig = [
  { type: "thumbsup" as const, Icon: ThumbsUp, label: "Like" },
  { type: "heart" as const, Icon: Heart, label: "Love" },
  { type: "thumbsdown" as const, Icon: ThumbsDown, label: "Dislike" },
];

export default function ReactionBar({ postId, counts: initialCounts, userReaction: initialReaction }: ReactionBarProps) {
  const supabase = createClient();
  const [, startTransition] = useTransition();
  const [currentReaction, setCurrentReaction] = useState(initialReaction);
  const [optimisticCounts, addOptimistic] = useOptimistic(
    initialCounts,
    (state: ReactionCounts, action: { type: keyof ReactionCounts; delta: number }) => ({
      ...state,
      [action.type]: Math.max(0, state[action.type] + action.delta),
    })
  );

  async function toggleReaction(type: "thumbsup" | "heart" | "thumbsdown") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    startTransition(async () => {
      if (currentReaction === type) {
        addOptimistic({ type, delta: -1 });
        setCurrentReaction(null);
        await supabase.from("reactions").delete().eq("post_id", postId).eq("user_id", user.id);
      } else {
        if (currentReaction) {
          addOptimistic({ type: currentReaction as keyof ReactionCounts, delta: -1 });
        }
        addOptimistic({ type, delta: 1 });
        setCurrentReaction(type);

        await supabase.from("reactions").upsert(
          { post_id: postId, user_id: user.id, type },
          { onConflict: "post_id,user_id" }
        );
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      {reactionConfig.map(({ type, Icon, label }) => {
        const isActive = currentReaction === type;
        const count = optimisticCounts[type];

        return (
          <button
            key={type}
            onClick={() => toggleReaction(type)}
            aria-label={label}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              isActive
                ? type === "thumbsdown"
                  ? "bg-error/10 text-error"
                  : "bg-accent/10 text-accent"
                : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            }`}
          >
            <Icon size={16} weight={isActive ? "fill" : "regular"} />
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
