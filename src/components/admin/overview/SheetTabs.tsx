import Link from "next/link";
import KnifeStroke from "../KnifeStroke";

export const TABS = ["leads", "clients", "emails", "activity"] as const;
export type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = { leads: "Leads", clients: "Clients", emails: "Emails", activity: "Activity" };

/** The sheet's tabs. The current one sits on a knife stroke, like the current page in the nav. */
export default function SheetTabs({ current, counts }: { current: Tab; counts: Partial<Record<Tab, number>> }) {
  return (
    <nav aria-label="Sheets">
      <ul className="flex flex-wrap gap-x-1">
        {TABS.map((tab, index) => {
          const selected = tab === current;
          return (
            <li key={tab}>
              <Link
                href={`/admin/overview?tab=${tab}`}
                aria-current={selected ? "page" : undefined}
                className={`relative isolate flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-base sm:gap-2 sm:px-4 sm:text-lg whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ink ${selected ? "text-ink font-semibold" : "text-ink-soft hover:bg-paper-shade hover:text-ink"}`}
              >
                {selected && <KnifeStroke variant={index} className="text-vermilion/25 absolute inset-x-1 inset-y-2 -z-10 h-[calc(100%-1rem)] w-[calc(100%-0.5rem)]" />}
                {TAB_LABEL[tab]}
                {counts[tab] !== undefined && <span className={`text-sm tabular-nums sm:text-base ${selected ? "text-ink-soft" : "text-ink-faint"}`}>{counts[tab]}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
