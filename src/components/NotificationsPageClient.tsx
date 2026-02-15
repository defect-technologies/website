"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ThumbsUp,
  Heart,
  ChatCircle,
  At,
  UserPlus,
  UsersThree,
  Trophy,
  Bell,
  CheckCircle,
} from "@phosphor-icons/react";
import type { Notification } from "@/types";

interface NotificationsPageClientProps {
  notifications: Notification[];
}

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  reaction: { icon: ThumbsUp, color: "text-accent" },
  comment: { icon: ChatCircle, color: "text-secondary" },
  mention: { icon: At, color: "text-accent" },
  follow_request: { icon: UserPlus, color: "text-primary" },
  follow_accepted: { icon: CheckCircle, color: "text-success" },
  invite: { icon: UsersThree, color: "text-secondary" },
  new_post: { icon: Bell, color: "text-text-secondary" },
  leaderboard: { icon: Trophy, color: "text-accent" },
};

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationsPageClient({ notifications: initial }: NotificationsPageClientProps) {
  const [notifications, setNotifications] = useState(initial);
  const supabase = createClient();

  useEffect(() => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    supabase
      .from("notifications")
      .update({ read: true })
      .in("id", unreadIds)
      .then();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-text-primary mb-1">Notifications</h1>
        <p className="text-sm text-text-secondary">Your recent activity</p>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell size={32} className="mx-auto text-text-secondary mb-2" />
          <p className="text-text-secondary text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notif) => {
            const config = typeConfig[notif.type] || typeConfig.new_post;
            const Icon = config.icon;

            const content = (
              <div
                className={`flex items-start gap-3 px-3 py-3 rounded-lg transition-colors ${
                  notif.read
                    ? "hover:bg-surface"
                    : "bg-accent/5 hover:bg-accent/10"
                }`}
              >
                <div className={`shrink-0 mt-0.5 ${config.color}`}>
                  <Icon size={20} weight={notif.read ? "regular" : "fill"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary">
                    <span className="font-medium">{notif.title}</span>
                    {notif.body && (
                      <span className="text-text-secondary"> — {notif.body}</span>
                    )}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">{timeAgo(notif.created_at)}</p>
                </div>
                {!notif.read && (
                  <div className="shrink-0 mt-2 h-2 w-2 rounded-full bg-accent" />
                )}
              </div>
            );

            if (notif.link) {
              return (
                <Link key={notif.id} href={notif.link} className="block">
                  {content}
                </Link>
              );
            }

            return <div key={notif.id}>{content}</div>;
          })}
        </div>
      )}
    </div>
  );
}
