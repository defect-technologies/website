"use client";

import { AddressBook, Browsers, CaretRight, ChatsCircle, ClockCounterClockwise, Crosshair, Detective, Eye, Eyedropper, GearSix, Hammer, HandPointing, PencilSimpleLine, PlugsConnected, Robot, SunHorizon, Swatches, UsersThree, VideoCamera, Wallet } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { TURN_PATH } from "@/lib/turn";
import { isCurrent as isCurrentIn, NavLink, type NavItem as Item } from "./NavLink";
import SearchBox from "./SearchBox";

const isCurrent = (pathname: string, href: string) => isCurrentIn(pathname, href, "/admin");

const SETUP: Item[] = [
  { href: "/admin/setup/bots", label: "Bots", icon: Robot },
  { href: "/admin/setup/template", label: "Email template", icon: PencilSimpleLine },
  { href: "/admin/setup/connections", label: "Connections", icon: PlugsConnected },
  { href: "/admin/setup/spot-checks", label: "Spot checks", icon: Eye },
  { href: "/admin/setup/taste", label: "Taste", icon: Eyedropper },
  { href: "/admin/setup/designers", label: "Designers", icon: UsersThree },
  { href: "/admin/setup/critics", label: "Critics", icon: Detective },
  { href: "/admin/setup/prospects", label: "Prospects", icon: AddressBook },
  { href: "/admin/setup/activity", label: "Activity log", icon: ClockCounterClockwise },
  { href: "/admin/setup/video", label: "Welcome video", icon: VideoCamera },
];

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

export default function AdminNav({ counts, building }: { counts: { today: number; turn: number; messages: number }; building: boolean }) {
  const pathname = usePathname();
  // One number says how much waits for a founder's taste. Designs and Review are where that work is found by kind.
  const items: Item[] = [
    { href: "/admin", label: "Today", icon: SunHorizon, count: counts.today },
    { href: TURN_PATH, label: "Your turn", icon: HandPointing, count: counts.turn },
    { href: "/admin/designs", label: "Designs", icon: Swatches },
    { href: "/admin/review", label: "Review", icon: Crosshair },
    { href: "/admin/builds", label: "Builds", icon: Hammer, live: building },
    { href: "/admin/sites", label: "Sites", icon: Browsers },
    { href: "/admin/messages", label: "Messages", icon: ChatsCircle, count: counts.messages },
    { href: "/admin/money", label: "Money", icon: Wallet },
  ];

  return (
    <nav aria-label="Admin" className="flex flex-col gap-3">
      <SearchBox />
      <div className="flex flex-col gap-1">
      <ul className="flex flex-wrap gap-x-1 lg:flex-col">
        {items.map((item, index) => (
          <li key={item.href}>
            <NavLink item={item} current={isCurrent(pathname, item.href)} index={index} />
          </li>
        ))}
      </ul>
      <SetupGroup pathname={pathname} />
      </div>
    </nav>
  );
}
