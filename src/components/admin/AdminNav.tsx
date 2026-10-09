"use client";

import { Browsers, ChatsCircle, Flag, Funnel, Gauge, PaperPlaneTilt, PencilSimpleLine, Receipt, Robot, type Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import KnifeStroke from "./KnifeStroke";

type Item = { href: string; label: string; icon: Icon; count?: number };

function isCurrent(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export default function AdminNav({ counts }: { counts: { outreach: number; messages: number; review: number } }) {
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/admin", label: "Outreach", icon: PaperPlaneTilt, count: counts.outreach },
    { href: "/admin/messages", label: "Messages", icon: ChatsCircle, count: counts.messages },
    { href: "/admin/review", label: "Review queue", icon: Flag, count: counts.review },
    { href: "/admin/pipeline", label: "Pipeline", icon: Funnel },
    { href: "/admin/sites", label: "Sites", icon: Browsers },
    { href: "/admin/projects", label: "Projects", icon: Gauge },
    { href: "/admin/expenses", label: "Expenses", icon: Receipt },
    { href: "/admin/bots", label: "Bots", icon: Robot },
    { href: "/admin/template", label: "Template", icon: PencilSimpleLine },
  ];

  return (
    <nav aria-label="Admin" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map((item, index) => {
          const current = isCurrent(pathname, item.href);
          const ItemIcon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`relative isolate flex min-h-11 items-center gap-3 rounded-xl px-3 text-base whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ink ${current ? "text-ink font-semibold" : "text-ink-soft hover:bg-paper-shade hover:text-ink"}`}
              >
                {current && <KnifeStroke variant={index} className="text-vermilion/25 absolute inset-x-1 inset-y-1.5 -z-10 h-[calc(100%-0.75rem)] w-[calc(100%-0.5rem)]" />}
                <ItemIcon size={20} weight={current ? "fill" : "regular"} aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {Boolean(item.count) && (
                  <span className="bg-ink text-paper min-w-6 rounded-full px-1.5 text-center text-sm font-semibold tabular-nums">
                    {item.count}
                    <span className="sr-only"> waiting</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
