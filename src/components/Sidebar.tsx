"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "@/components/ui/Avatar";
import {
  House,
  UsersThree,
  UserList,
  User,
  Gear,
  Bell,
  Plus,
  SignOut,
  LinkSimple,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import type { User as UserType, Circle } from "@/types";

interface SidebarProps {
  user: UserType | null;
  circles: Circle[];
  unseenCounts?: Record<string, number>;
  pendingFollowCount?: number;
  unreadNotificationCount?: number;
}

const navItems = [
  { href: "/", icon: House, label: "Home" },
  { href: "/people", icon: UserList, label: "People", badgeKey: "people" },
  { href: "/notifications", icon: Bell, label: "Notifications", badgeKey: "notifications" },
  { href: "/groups", icon: UsersThree, label: "Audience Lists" },
  { href: "/settings", icon: Gear, label: "Settings" },
];

function BadgePill({ count }: { count: number }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
          className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-accent text-white text-[10px] font-bold px-1"
        >
          {count > 99 ? "99+" : count}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export default function Sidebar({
  user,
  circles,
  unseenCounts: initialUnseenCounts = {},
  pendingFollowCount: initialPendingCount = 0,
  unreadNotificationCount: initialNotifCount = 0,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [unseenCounts, setUnseenCounts] = useState(initialUnseenCounts);
  const [pendingFollowCount, setPendingFollowCount] = useState(initialPendingCount);
  const [unreadNotifCount, setUnreadNotifCount] = useState(initialNotifCount);

  const totalBadge = pendingFollowCount + unreadNotifCount;

  useEffect(() => {
    if (totalBadge > 0) {
      document.title = `(${totalBadge}) Devlog`;
    } else {
      document.title = "Devlog";
    }
  }, [totalBadge]);

  useEffect(() => {
    if (!user) return;

    const notifChannel = supabase
      .channel("sidebar-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          setUnreadNotifCount((prev) => prev + 1);
        }
      )
      .subscribe();

    const followChannel = supabase
      .channel("sidebar-follows")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "follows",
          filter: `following_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && (payload.new as { status: string }).status === "pending") {
            setPendingFollowCount((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "follows",
          filter: `following_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && (payload.new as { status: string }).status === "accepted") {
            setPendingFollowCount((prev) => Math.max(0, prev - 1));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "follows",
          filter: `following_id=eq.${user.id}`,
        },
        () => {
          setPendingFollowCount((prev) => Math.max(0, prev - 1));
        }
      )
      .subscribe();

    const postsChannel = supabase
      .channel("sidebar-posts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
        },
        (payload) => {
          const post = payload.new as { circle_id: string | null; author_id: string; visibility: string };
          if (
            post.circle_id &&
            post.visibility === "circle" &&
            post.author_id !== user.id &&
            circles.some((c) => c.id === post.circle_id)
          ) {
            if (pathname !== `/c/${post.circle_id}`) {
              setUnseenCounts((prev) => ({
                ...prev,
                [post.circle_id!]: (prev[post.circle_id!] || 0) + 1,
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(followChannel);
      supabase.removeChannel(postsChannel);
    };
  }, [user, supabase, circles, pathname]);

  // When navigating to notifications, clear the badge
  useEffect(() => {
    if (pathname === "/notifications") {
      setUnreadNotifCount(0);
    }
  }, [pathname]);

  // When navigating to people, clear follow request badge
  useEffect(() => {
    if (pathname === "/people") {
      setPendingFollowCount(0);
    }
  }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 sticky top-0 h-screen py-6 pr-6 flex flex-col">
      <Link href="/" className="font-serif text-xl font-bold text-primary mb-8">
        Devlog
      </Link>

      <nav className="space-y-1">
        {navItems.map(({ href, icon: Icon, label, badgeKey }) => {
          const active = pathname === href;
          const badge = badgeKey === "people" ? pendingFollowCount
            : badgeKey === "notifications" ? unreadNotifCount
            : 0;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-surface text-primary"
                  : "text-text-secondary hover:text-primary hover:bg-surface"
              }`}
            >
              <Icon size={20} weight={active ? "fill" : "regular"} />
              <span className="flex-1 flex flex-row items-center">
                {label}
                {badge > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="h-1.5 w-1.5 bg-accent rounded-full ml-1.5"
                  />
                )}
              </span>
              <BadgePill count={badge} />
            </Link>
          );
        })}
        {user?.username && (
          <Link
            href={`/${user.username}`}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              pathname === `/${user.username}`
                ? "bg-surface text-primary"
                : "text-text-secondary hover:text-primary hover:bg-surface"
            }`}
          >
            <User size={20} weight={pathname === `/${user.username}` ? "fill" : "regular"} />
            Profile
          </Link>
        )}
      </nav>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide">Circles</h3>
          <div className="flex items-center gap-1.5">
            <Link href="/join" className="text-text-secondary hover:text-accent transition-colors" title="Join with code">
              <LinkSimple size={16} />
            </Link>
            <Link href="/c/new" className="text-text-secondary hover:text-accent transition-colors" title="Create circle">
              <Plus size={16} />
            </Link>
          </div>
        </div>
        <p className="text-[11px] text-text-secondary/60 px-3 mb-2">Compete and share with your teams</p>
        <div className="space-y-0.5">
          {circles.map((circle) => {
            const unseen = unseenCounts[circle.id] || 0;
            return (
              <Link
                key={circle.id}
                href={`/c/${circle.id}`}
                onClick={() => {
                  if (unseen > 0) {
                    setUnseenCounts((prev) => {
                      const next = { ...prev };
                      delete next[circle.id];
                      return next;
                    });
                  }
                }}
                className={`flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors ${
                  pathname === `/c/${circle.id}`
                    ? "bg-surface text-primary font-medium"
                    : "text-text-secondary hover:text-primary hover:bg-surface"
                }`}
              >
                <span className="truncate">{circle.name}</span>
                <BadgePill count={unseen > 20 ? 21 : unseen} />
              </Link>
            );
          })}
          {circles.length === 0 && (
            <p className="px-3 py-1.5 text-xs text-text-secondary">No circles yet</p>
          )}
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-border/50">
        <div className="flex items-center gap-3 px-3">
          <Avatar
            src={user?.avatar_url}
            name={user?.display_name || "User"}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{user?.display_name}</p>
            <p className="text-xs text-text-secondary truncate">@{user?.username}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-text-secondary hover:text-error transition-colors cursor-pointer"
            title="Sign out"
          >
            <SignOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
