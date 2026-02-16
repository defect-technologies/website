"use client";

import { useState } from "react";
import Avatar from "@/components/ui/Avatar";
import { Trophy, Crown, Medal } from "@phosphor-icons/react";
import type { LeaderboardEntry } from "@/types";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  prizeDescription?: string | null;
}

type Period = "week" | "month";

export default function Leaderboard({ entries, prizeDescription }: LeaderboardProps) {
  const [period, setPeriod] = useState<Period>("week");

  function getRankIcon(rank: number) {
    if (rank === 1) return <Crown size={16} weight="fill" className="text-yellow-600" />;
    if (rank === 2) return <Medal size={16} weight="fill" className="text-gray-400" />;
    if (rank === 3) return <Medal size={16} weight="fill" className="text-amber-700" />;
    return <span className="text-xs text-text-secondary font-medium w-4 text-center">{rank}</span>;
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-secondary" weight="fill" />
            <h3 className="font-serif font-semibold text-text-primary">Leaderboard</h3>
          </div>
          <div className="flex rounded-md border border-border text-xs">
            <button
              onClick={() => setPeriod("week")}
              className={`px-2.5 py-1 cursor-pointer transition-colors rounded-l-lg ${
                period === "week" ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setPeriod("month")}
              className={`px-2.5 py-1 cursor-pointer transition-colors rounded-r-lg ${
                period === "month" ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Month
            </button>
          </div>
        </div>
        {prizeDescription && (
          <p className="text-xs text-accent mt-2 font-medium">{prizeDescription}</p>
        )}
      </div>

      <div className="divide-y divide-border/50">
        {entries.length === 0 && (
          <p className="p-4 text-sm text-text-secondary text-center">No scores yet this {period}</p>
        )}
        {entries.map((entry) => (
          <div key={entry.user_id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-5 flex justify-center">{getRankIcon(entry.rank)}</div>
            <Avatar src={entry.avatar_url} name={entry.display_name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{entry.display_name}</p>
              <p className="text-xs text-text-secondary">{entry.post_count} posts</p>
            </div>
            <span className="text-sm font-semibold text-secondary">{Math.round(entry.points)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
