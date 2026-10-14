import Link from "next/link";
import KnifeStroke from "./KnifeStroke";

export type PageTab = { href: string; label: string; count?: number };

export const SITE_TABS: PageTab[] = [
  { href: "/admin/sites", label: "Sites" },
  { href: "/admin/sites/previews", label: "Previews" },
  { href: "/admin/sites/changes", label: "Site changes" },
];

/** Views of one page. The current one sits on a knife stroke, like the current page in the nav. */
export default function PageTabs({ tabs, current, label }: { tabs: PageTab[]; current: string; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-x-1">
        {tabs.map((tab, index) => {
          const selected = tab.href === current;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={selected ? "page" : undefined}
                className={`relative isolate flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-base whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ink sm:gap-2 sm:px-4 sm:text-lg ${selected ? "text-ink font-semibold" : "text-ink-soft hover:bg-paper-shade hover:text-ink"}`}
              >
                {selected && <KnifeStroke variant={index} className="text-vermilion/25 absolute inset-x-1 inset-y-2 -z-10 h-[calc(100%-1rem)] w-[calc(100%-0.5rem)]" />}
                {tab.label}
                {tab.count !== undefined && <span className={`text-sm tabular-nums sm:text-base ${selected ? "text-ink-soft" : "text-ink-faint"}`}>{tab.count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
