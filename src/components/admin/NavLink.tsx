"use client";

import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import KnifeStroke from "./KnifeStroke";
import WorkingDot from "./overview/WorkingDot";

export type NavItem = { href: string; label: string; icon: Icon; count?: number; live?: boolean };

export function isCurrent(pathname: string, href: string, home: string) {
  return href === home ? pathname === home : pathname.startsWith(href);
}

/** One place in a sidebar: the current one is marked with a knife stroke and a filled icon. */
export function NavLink({ item, current, index }: { item: NavItem; current: boolean; index: number }) {
  const ItemIcon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={`relative isolate flex min-h-11 items-center gap-3 rounded-xl px-3 text-base whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ink ${current ? "text-ink font-semibold" : "text-ink-soft hover:bg-paper-shade hover:text-ink"}`}
    >
      {current && <KnifeStroke variant={index} className="text-vermilion/25 absolute inset-x-1 inset-y-1.5 -z-10 h-[calc(100%-0.75rem)] w-[calc(100%-0.5rem)]" />}
      <ItemIcon size={20} weight={current ? "fill" : "regular"} aria-hidden="true" />
      <span className="flex-1">{item.label}</span>
      {item.live && (
        <span title="Building now">
          <WorkingDot />
          <span className="sr-only"> building now</span>
        </span>
      )}
      {Boolean(item.count) && (
        <span className="bg-ink text-paper min-w-6 rounded-full px-1.5 text-center text-sm font-semibold tabular-nums">
          {item.count}
          <span className="sr-only"> waiting</span>
        </span>
      )}
    </Link>
  );
}

