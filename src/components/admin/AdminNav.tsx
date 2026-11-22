"use client";

import { ChatsCircle, Eye, Hammer, ListChecks, PaperPlaneTilt, Robot, Storefront, UsersThree, Wallet } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { isCurrent as isCurrentIn, NavLink, type NavItem } from "./NavLink";
import SearchBox from "./SearchBox";

/** A nav place, and the pages outside its own path that are reached from it. */
type Item = NavItem & { reaches?: string[] };

const isCurrent = (pathname: string, item: Item) => isCurrentIn(pathname, item.href, "/admin") || (item.reaches ?? []).some((path) => pathname.startsWith(path));

const SETUP: Item[] = [
  { href: "/admin/setup/outreach", label: "Outreach", icon: PaperPlaneTilt },
  { href: "/admin/setup/runner", label: "Runner", icon: Robot },
  { href: "/admin/setup/designers", label: "Designers", icon: UsersThree },
  { href: "/admin/setup/spot-checks", label: "Spot checks", icon: Eye },
];

function NavList({ items, pathname, label }: { items: Item[]; pathname: string; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-x-1 lg:flex-col">
      {items.map((item, index) => (
        <li key={item.href}>
          <NavLink item={item} current={isCurrent(pathname, item)} index={index} />
        </li>
      ))}
    </ul>
  );
}

export default function AdminNav({ counts, building }: { counts: { todo: number; messages: number }; building: boolean }) {
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/admin", label: "To do", icon: ListChecks, count: counts.todo, reaches: ["/admin/designs", "/admin/review", "/admin/setup/activity"] },
    { href: "/admin/sites", label: "Businesses", icon: Storefront },
    { href: "/admin/builds", label: "Builds", icon: Hammer, live: building },
    { href: "/admin/messages", label: "Messages", icon: ChatsCircle, count: counts.messages },
    { href: "/admin/money", label: "Money", icon: Wallet },
  ];

  return (
    <nav aria-label="Admin" className="flex flex-col gap-3">
      <SearchBox />
      <NavList items={items} pathname={pathname} label="Work" />
      <div className="border-ink/10 border-t pt-3">
        <NavList items={SETUP} pathname={pathname} label="Setup" />
      </div>
    </nav>
  );
}
