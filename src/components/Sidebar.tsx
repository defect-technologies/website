"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import {
  House,
  UsersThree,
  UserList,
  User,
  Gear,
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
}

const navItems = [
  { href: "/", icon: House, label: "Home" },
  { href: "/people", icon: UserList, label: "People" },
  { href: "/groups", icon: UsersThree, label: "Audience Lists" },
  { href: "/settings", icon: Gear, label: "Settings" },
];

export default function Sidebar({ user, circles, unseenCounts: initialUnseenCounts = {}, pendingFollowCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [unseenCounts, setUnseenCounts] = useState(initialUnseenCounts);

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
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          const badge = href === "/people" ? pendingFollowCount : 0;
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
              <span className="flex-1 flex flex-row items-start gap-0.px">
                {label}
                {badge > 0 && (
                  <div className="h-1 w-1 bg-accent rounded-full ml-1 mt-1" />
                )}
              </span>
              {badge > 0 && (
                <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-accent text-white text-[10px] font-bold px-1">
                  {badge}
                </span>
              )}
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
                {unseen > 0 && (
                  <span className="shrink-0 ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-accent text-white text-[10px] font-bold px-1">
                    {unseen > 20 ? "20+" : unseen}
                  </span>
                )}
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
