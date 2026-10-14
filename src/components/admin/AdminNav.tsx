"use client";

import {
  AddressBook,
  Browsers,
  CaretRight,
  ChatsCircle,
  ClockCounterClockwise,
  Eye,
  GearSix,
  type Icon,
  PencilSimpleLine,
  PlugsConnected,
  Robot,
  Storefront,
  SunHorizon,
  VideoCamera,
  Wallet,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import KnifeStroke from "./KnifeStroke";

type Item = { href: string; label: string; icon: Icon; count?: number };

const SETUP: Item[] = [
  { href: "/admin/setup/bots", label: "Bots", icon: Robot },
  { href: "/admin/setup/template", label: "Email template", icon: PencilSimpleLine },
  { href: "/admin/setup/connections", label: "Connections", icon: PlugsConnected },
  { href: "/admin/setup/spot-checks", label: "Spot checks", icon: Eye },
  { href: "/admin/setup/prospects", label: "Prospects", icon: AddressBook },
  { href: "/admin/setup/activity", label: "Activity log", icon: ClockCounterClockwise },
  { href: "/admin/setup/video", label: "Welcome video", icon: VideoCamera },
];

function isCurrent(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function NavLink({ item, current, index }: { item: Item; current: boolean; index: number }) {
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
      {Boolean(item.count) && (
        <span className="bg-ink text-paper min-w-6 rounded-full px-1.5 text-center text-sm font-semibold tabular-nums">
          {item.count}
          <span className="sr-only"> waiting</span>
        </span>
      )}
    </Link>
  );
}

function SetupGroup({ pathname }: { pathname: string }) {
  const inSetup = pathname.startsWith("/admin/setup");
  return (
    <details open={inSetup} className="group/setup">
      <summary className="text-ink-soft hover:bg-paper-shade hover:text-ink flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 text-base transition-colors duration-150 [&::-webkit-details-marker]:hidden">
        <GearSix size={20} weight={inSetup ? "fill" : "regular"} aria-hidden="true" />
        <span className="flex-1">Setup</span>
        <CaretRight size={14} weight="bold" className="transition-transform duration-150 group-open/setup:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <ul className="flex flex-col lg:pl-3">
        {SETUP.map((item, index) => (
          <li key={item.href}>
            <NavLink item={item} current={isCurrent(pathname, item.href)} index={index} />
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function AdminNav({ counts }: { counts: { today: number; messages: number } }) {
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/admin", label: "Today", icon: SunHorizon, count: counts.today },
    { href: "/admin/leads", label: "Leads", icon: Storefront },
    { href: "/admin/clients", label: "Clients", icon: Browsers },
    { href: "/admin/messages", label: "Messages", icon: ChatsCircle, count: counts.messages },
    { href: "/admin/money", label: "Money", icon: Wallet },
  ];

  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      <ul className="flex flex-wrap gap-x-1 lg:flex-col">
        {items.map((item, index) => (
          <li key={item.href}>
            <NavLink item={item} current={isCurrent(pathname, item.href)} index={index} />
          </li>
        ))}
      </ul>
      <SetupGroup pathname={pathname} />
    </nav>
  );
}
