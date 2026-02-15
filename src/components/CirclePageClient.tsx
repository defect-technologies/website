"use client";

import Composer from "@/components/Composer";
import Timeline from "@/components/Timeline";
import Leaderboard from "@/components/Leaderboard";
import JoinButton from "@/components/JoinButton";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { useState, useEffect, useMemo } from "react";
import { UsersThree, Trophy, LinkSimple, Check, Copy, UserPlus, MagnifyingGlass, X } from "@phosphor-icons/react";
import type { Circle, Post, LeaderboardEntry, User } from "@/types";

interface CirclePageClientProps {
  circle: Circle & { invite_code?: string };
  posts: Post[];
  leaderboard: LeaderboardEntry[];
  userCircles: Circle[];
  currentUserId: string;
  isMember: boolean;
  isAdmin: boolean;
  invitableFollowers?: User[];
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
    <div className="flex items-center gap-2 text-xs text-text-secondary">
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

function InviteSection({ circleId, followers: initialFollowers }: { circleId: string; followers: User[] }) {
  const [followers, setFollowers] = useState(initialFollowers);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!searchQuery) return followers;
    const q = searchQuery.toLowerCase();
    return followers.filter(
      (f) => f.username.toLowerCase().includes(q) || f.display_name.toLowerCase().includes(q)
    );
  }, [followers, searchQuery]);

  async function handleInvite(userId: string) {
    setInvitingId(userId);
    const res = await fetch(`/api/circles/${circleId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setInvited((prev) => new Set(prev).add(userId));
      setFollowers((prev) => prev.filter((f) => f.id !== userId));
    }
    setInvitingId(null);
  }

  if (followers.length === 0 && invited.size === 0) return null;

  return (
    <div className="mt-4">
      <button
        onClick={() => setShowSearch(!showSearch)}
        className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-accent transition-colors cursor-pointer"
      >
        <UserPlus size={14} />
        Invite people
      </button>

      {showSearch && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2 border border-border rounded-md px-2.5 py-1.5 bg-background">
            <MagnifyingGlass size={14} className="text-text-secondary shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your followers..."
              className="flex-1 text-xs bg-transparent text-text-primary placeholder:text-text-secondary/50 focus:outline-none"
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="cursor-pointer">
                <X size={12} className="text-text-secondary" />
              </button>
            )}
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {filtered.map((user) => (
              <div key={user.id} className="flex items-center gap-2.5 py-1.5 px-1">
                <Avatar src={user.avatar_url} name={user.display_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{user.display_name}</p>
                  <p className="text-xs text-text-secondary truncate">@{user.username}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleInvite(user.id)}
                  loading={invitingId === user.id}
                >
                  Invite
                </Button>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-text-secondary py-2">
                {searchQuery ? "No matching followers" : "All your followers are already in this circle"}
              </p>
            )}
          </div>
        </div>
      )}
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
  invitableFollowers = [],
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

        {isMember && (
          <div className="mt-4 flex flex-col gap-2">
            {circle.invite_code && <InviteCodeCopy code={circle.invite_code} />}
            <InviteSection circleId={circle.id} followers={invitableFollowers} />
          </div>
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
