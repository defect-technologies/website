"use client";

import { HandPointing, ListChecks, Swatches, Wallet } from "@phosphor-icons/react";
import { DESIGNER_HOME } from "@/lib/designerWork";
import { usePathname } from "next/navigation";
import { isCurrent, NavLink, type NavItem } from "../NavLink";

/** A designer's whole area: what waits for them, businesses to take, everything they took, and their pay. */
export default function DesignerNav({ counts }: { counts: { turn: number; pool: number } }) {
  const pathname = usePathname();
  const items: NavItem[] = [
    { href: DESIGNER_HOME, label: "Your turn", icon: HandPointing, count: counts.turn },
    { href: "/designer/pool", label: "Take a design", icon: Swatches, count: counts.pool },
    { href: "/designer/history", label: "Your designs", icon: ListChecks },
    { href: "/designer/pay", label: "Pay", icon: Wallet },
  ];
  return (
    <nav aria-label="Designer">
      <ul className="flex flex-wrap gap-x-1 lg:flex-col lg:gap-1">
        {items.map((item, index) => (
          <li key={item.href}>
            <NavLink item={item} current={isCurrent(pathname, item.href, DESIGNER_HOME)} index={index} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
