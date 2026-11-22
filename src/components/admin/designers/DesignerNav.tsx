"use client";

import { ListChecks, Swatches, Wallet } from "@phosphor-icons/react";
import { DESIGNER_HOME } from "@/lib/designerWork";
import { usePathname } from "next/navigation";
import { isCurrent, NavLink, type NavItem } from "../NavLink";

/** A designer's whole area: what they can act on, what they designed before, and their pay. */
export default function DesignerNav({ counts }: { counts: { todo: number } }) {
  const pathname = usePathname();
  const items: NavItem[] = [
    { href: DESIGNER_HOME, label: "To do", icon: Swatches, count: counts.todo },
    { href: "/designer/history", label: "Past designs", icon: ListChecks },
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
