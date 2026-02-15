"use client";

import Avatar from "@/components/ui/Avatar";
import { CalendarBlank, Star } from "@phosphor-icons/react";
import type { User } from "@/types";

interface ProfileHeaderProps {
  profile: User;
}

export default function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <div className="flex items-start gap-5">
      <Avatar src={profile.avatar_url} name={profile.display_name} size="xl" />
      <div className="flex-1">
        <h1 className="font-serif text-2xl font-bold text-text-primary">{profile.display_name}</h1>
        <p className="text-sm text-text-secondary">@{profile.username}</p>
        {profile.bio && (
          <p className="text-sm text-text-primary mt-2">{profile.bio}</p>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
          <span className="inline-flex items-center gap-1">
            <Star size={14} weight="fill" className="text-secondary" />
            {Math.round(profile.total_points)} points
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
