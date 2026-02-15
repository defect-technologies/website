"use client";

import { useState } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import { MagnifyingGlass, UserPlus, Check, Clock } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import type { User, FollowStatus } from "@/types";

interface PeoplePageClientProps {
  users: User[];
  followStatusMap: Record<string, FollowStatus>;
  mutualCircleMap: Record<string, string[]>;
  currentUserId: string;
}

export default function PeoplePageClient({
  users: initialUsers,
  followStatusMap: initialFollowMap,
  mutualCircleMap,
  currentUserId,
}: PeoplePageClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [followMap, setFollowMap] = useState(initialFollowMap);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    const { data } = await supabase
      .from("users")
      .select("*")
      .neq("id", currentUserId)
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(20);

    setSearchResults((data || []) as User[]);
    setSearching(false);
  }

  async function handleFollow(userId: string) {
    const status = followMap[userId];
    setLoadingId(userId);

    if (!status || status === "none") {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) setFollowMap((prev) => ({ ...prev, [userId]: "pending" }));
    } else {
      const res = await fetch(`/api/follows?userId=${userId}`, { method: "DELETE" });
      if (res.ok) setFollowMap((prev) => ({ ...prev, [userId]: "none" }));
    }

    setLoadingId(null);
  }

  const displayUsers = searchResults ?? users;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-text-primary mb-1">People</h1>
        <p className="text-sm text-text-secondary">Discover and connect with others</p>
      </div>

      <div className="relative">
        <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or username..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-surface text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-secondary/30"
        />
      </div>

      {searching && <p className="text-sm text-text-secondary">Searching...</p>}

      <div className="space-y-2">
        {displayUsers.map((person) => {
          const status = followMap[person.id] || "none";
          const mutualCircles = mutualCircleMap[person.id] || [];

          return (
            <div
              key={person.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <Link href={`/${person.username}`}>
                <Avatar src={person.avatar_url} name={person.display_name} size="md" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/${person.username}`} className="hover:underline">
                  <p className="text-sm font-medium text-text-primary truncate">{person.display_name}</p>
                </Link>
                <p className="text-xs text-text-secondary truncate">@{person.username}</p>
                {person.bio && (
                  <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{person.bio}</p>
                )}
                {mutualCircles.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {mutualCircles.slice(0, 2).map((name) => (
                      <Badge key={name} className="text-[10px]">{name}</Badge>
                    ))}
                    {mutualCircles.length > 2 && (
                      <span className="text-[10px] text-text-secondary">+{mutualCircles.length - 2} more</span>
                    )}
                  </div>
                )}
              </div>
              <PersonFollowButton
                status={status}
                loading={loadingId === person.id}
                onClick={() => handleFollow(person.id)}
              />
            </div>
          );
        })}

        {displayUsers.length === 0 && !searching && (
          <p className="text-center text-sm text-text-secondary py-8">
            {searchQuery ? "No users found" : "No users to show yet"}
          </p>
        )}
      </div>
    </div>
  );
}

function PersonFollowButton({
  status,
  loading,
  onClick,
}: {
  status: FollowStatus;
  loading: boolean;
  onClick: () => void;
}) {
  if (status === "accepted") {
    return (
      <Button variant="secondary" size="sm" onClick={onClick} loading={loading}>
        <Check size={14} weight="bold" />
        Following
      </Button>
    );
  }

  if (status === "pending") {
    return (
      <Button variant="secondary" size="sm" onClick={onClick} loading={loading}>
        <Clock size={14} />
        Pending
      </Button>
    );
  }

  return (
    <Button size="sm" onClick={onClick} loading={loading}>
      <UserPlus size={14} weight="bold" />
      Follow
    </Button>
  );
}
