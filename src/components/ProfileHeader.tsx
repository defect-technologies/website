"use client";

import { useState } from "react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { CalendarBlank, Star, UserPlus, Check, Clock } from "@phosphor-icons/react";
import type { User, FollowStatus } from "@/types";

interface ProfileHeaderProps {
  profile: User;
  currentUserId?: string;
  followerCount?: number;
  followingCount?: number;
  followStatus?: FollowStatus;
}

export default function ProfileHeader({
  profile,
  currentUserId,
  followerCount = 0,
  followingCount = 0,
  followStatus: initialStatus = "none",
}: ProfileHeaderProps) {
  const [followStatus, setFollowStatus] = useState(initialStatus);
  const [followers, setFollowers] = useState(followerCount);
  const [loading, setLoading] = useState(false);
  const isOwnProfile = currentUserId === profile.id;

  async function handleFollowClick() {
    if (loading) return;
    setLoading(true);

    if (followStatus === "none") {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id }),
      });
      if (res.ok) setFollowStatus("pending");
    } else {
      const res = await fetch(`/api/follows?userId=${profile.id}`, { method: "DELETE" });
      if (res.ok) {
        if (followStatus === "accepted") setFollowers((p) => p - 1);
        setFollowStatus("none");
      }
    }

    setLoading(false);
  }

  return (
    <div className="flex items-start gap-5">
      <Avatar src={profile.avatar_url} name={profile.display_name} size="xl" />
      <div className="flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-text-primary">{profile.display_name}</h1>
            <p className="text-sm text-text-secondary">@{profile.username}</p>
          </div>
          {currentUserId && !isOwnProfile && (
            <FollowButton
              status={followStatus}
              loading={loading}
              onClick={handleFollowClick}
            />
          )}
        </div>
        {profile.bio && (
          <p className="text-sm text-text-primary mt-2">{profile.bio}</p>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
          <span className="font-medium text-text-primary">{followers} <span className="font-normal text-text-secondary">followers</span></span>
          <span className="font-medium text-text-primary">{followingCount} <span className="font-normal text-text-secondary">following</span></span>
          <span className="inline-flex items-center gap-1">
            <Star size={14} weight="fill" className="text-secondary" />
            {Math.round(profile.total_points)} pts
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarBlank size={14} />
            Joined {new Date(profile.joined_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
        </div>
      </div>
    </div>
  );
}

function FollowButton({
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
