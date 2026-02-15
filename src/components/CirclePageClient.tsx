"use client";

import Composer from "@/components/Composer";
import Timeline from "@/components/Timeline";
import Leaderboard from "@/components/Leaderboard";
import JoinButton from "@/components/JoinButton";
import Badge from "@/components/ui/Badge";
import { useState, useEffect } from "react";
import { UsersThree, Trophy, LinkSimple, Check, Copy } from "@phosphor-icons/react";
import type { Circle, Post, LeaderboardEntry } from "@/types";

interface CirclePageClientProps {
  circle: Circle & { invite_code?: string };
  posts: Post[];
  leaderboard: LeaderboardEntry[];
  userCircles: Circle[];
  currentUserId: string;
  isMember: boolean;
  isAdmin: boolean;
}

function useMarkCircleSeen(circleId: string, isMember: boolean) {
  useEffect(() => {
    if (!isMember) return;
    fetch(`/api/circles/${circleId}/seen`, { method: "POST" });
  }, [circleId, isMember]);
}

function InviteCodeCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-4 flex items-center gap-2 text-xs text-text-secondary">
      <LinkSimple size={14} />
      <span>Invite code:</span>
      <code className="bg-background px-1.5 py-0.5 rounded">{code}</code>
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-background transition-colors cursor-pointer"
      >
        {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function CirclePageClient({
  circle,
  posts,
  leaderboard,
  userCircles,
  currentUserId,
  isMember,
  isAdmin,
}: CirclePageClientProps) {
  useMarkCircleSeen(circle.id, isMember);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 pb-6 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-text-primary">{circle.name}</h1>
            {circle.description && (
              <p className="text-text-secondary mt-1">{circle.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3">
              <span className="inline-flex items-center gap-1 text-sm text-text-secondary">
                <UsersThree size={16} />
                {circle.member_count} members
              </span>
              {circle.prize_description && (
                <span className="inline-flex items-center gap-1 text-sm text-accent font-medium">
                  <Trophy size={16} weight="fill" />
                  {circle.prize_description}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isMember && <JoinButton circleId={circle.id} />}
            {isMember && <Badge variant="success">Member</Badge>}
            {isAdmin && <Badge variant="accent">Admin</Badge>}
          </div>
        </div>

        {circle.invite_code && isMember && (
          <InviteCodeCopy code={circle.invite_code} />
        )}
      </div>

      <div className="flex gap-6">
        <div className="flex-1 space-y-4">
          {isMember && <Composer circles={userCircles} defaultCircleId={circle.id} />}
          <Timeline posts={posts} currentUserId={currentUserId} />
        </div>
        <div className="w-72 shrink-0 hidden lg:block">
          <Leaderboard entries={leaderboard} prizeDescription={circle.prize_description} />
        </div>
      </div>
    </div>
  );
}
