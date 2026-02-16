"use client";

import { useState } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { Check, X } from "@phosphor-icons/react";
import type { User } from "@/types";

interface FollowRequestCardProps {
  user: User;
  onResponded: (userId: string) => void;
}

export default function FollowRequestCard({ user, onResponded }: FollowRequestCardProps) {
  const [responding, setResponding] = useState(false);

  async function handleResponse(action: "accept" | "reject") {
    setResponding(true);
    const res = await fetch("/api/follows/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ follower_id: user.id, action }),
    });
    if (res.ok) {
      onResponded(user.id);
    }
    setResponding(false);
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <Link href={`/${user.username}`}>
        <Avatar src={user.avatar_url} name={user.display_name} size="sm" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/${user.username}`} className="hover:underline">
          <p className="text-sm font-medium text-text-primary truncate">{user.display_name}</p>
        </Link>
        <p className="text-xs text-text-secondary truncate">@{user.username}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          onClick={() => handleResponse("accept")}
          loading={responding}
        >
          <Check size={14} weight="bold" />
          Accept
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleResponse("reject")}
          disabled={responding}
        >
          <X size={14} />
          Decline
        </Button>
      </div>
    </div>
  );
}
