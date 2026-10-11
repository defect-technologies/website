"use client";

import { ChartLine, CreditCard, UserCircle, type Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import KnifeStroke from "../admin/KnifeStroke";

const TABS: { href: string; label: string; icon: Icon }[] = [
  { href: "/portal", label: "Dashboard", icon: ChartLine },
  { href: "/portal/billing", label: "Billing", icon: CreditCard },
  { href: "/portal/account", label: "Account", icon: UserCircle },
];

/** The portal's sections. `site` keeps an owner with several sites on the one they picked. */
export default function PortalTabs({ site }: { site?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Portal" className="-mx-1 overflow-x-auto">
      <ul className="flex gap-1 px-1">
        {TABS.map((tab, index) => {
          const current = pathname === tab.href;
          const TabIcon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={site ? `${tab.href}?site=${encodeURIComponent(site)}` : tab.href}
                aria-current={current ? "page" : undefined}
                className={`relative isolate flex min-h-11 items-center gap-2 rounded-xl px-3 whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ink ${current ? "text-ink font-semibold" : "text-ink-soft hover:bg-paper-shade hover:text-ink"}`}
              >
                {current && <KnifeStroke variant={index} className="text-vermilion/25 absolute inset-x-1 inset-y-1.5 -z-10 h-[calc(100%-0.75rem)] w-[calc(100%-0.5rem)]" />}
                <TabIcon size={20} weight={current ? "fill" : "regular"} aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
