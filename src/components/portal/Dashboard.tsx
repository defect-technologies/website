import type { Icon } from "@phosphor-icons/react";
import { ArrowDownRight, ArrowUpRight, CalendarCheck, EnvelopeSimple, MapPin, Phone } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Card } from "@/components/admin/ui";
import { ACTIONS, RANGES, type Action, type Compared, type RangeDays, type Ranked, type SiteAnalytics } from "@/lib/siteAnalytics";
import VisitorsChart from "./VisitorsChart";

const ACTION_COPY: Record<Action, { label: string; what: string; icon: Icon }> = {
  Call: { label: "Calls", what: "Taps on your phone number", icon: Phone },
  Directions: { label: "Directions", what: "Opened your address in maps", icon: MapPin },
  Email: { label: "Emails", what: "Taps on your email address", icon: EnvelopeSimple },
  Book: { label: "Bookings", what: "Taps on your booking button", icon: CalendarCheck },
};

const count = (value: number) => value.toLocaleString("en-US");

/** How this period compares with the one before it. The comparison period is named once, beside the section heading. */
function Change({ value, days }: { value: Compared; days: RangeDays }) {
  const difference = value.now - value.before;
  const span = <span className="sr-only"> than the {days} days before</span>;
  if (value.now === 0 && value.before === 0) return <p className="text-ink-faint text-sm">No data yet</p>;
  if (difference === 0) return <p className="text-ink-faint text-sm">No change{span}</p>;
  const up = difference > 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className={`flex items-center gap-1 text-sm font-medium ${up ? "text-good" : "text-ink-soft"}`}>
      <Arrow size={16} weight="bold" aria-hidden="true" />
      <span>
        {count(Math.abs(difference))} {up ? "more" : "fewer"}
        {span}
      </span>
    </p>
  );
}

const ComparedWith = ({ days }: { days: RangeDays }) => <p className="text-ink-faint text-sm">Compared with the {days} days before</p>;

export function ActionTiles({ analytics, days }: { analytics: SiteAnalytics; days: RangeDays }) {
  return (
    <section aria-labelledby="reached-you" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id="reached-you" className="text-lg font-semibold">
          People who reached you
        </h2>
        <ComparedWith days={days} />
      </div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ACTIONS.map((action) => {
          const { label, what, icon: ActionIcon } = ACTION_COPY[action];
          const value = analytics.actions[action];
          return (
            <li key={action}>
              <Card className="flex h-full flex-col gap-2 p-5">
                <p className="text-ink-soft flex items-center gap-2 font-medium">
                  <ActionIcon size={20} aria-hidden="true" />
                  {label}
                </p>
                <p className="font-display text-6xl leading-none font-black tabular-nums">{count(value.now)}</p>
                <p className="text-ink-faint text-sm text-pretty">{what}</p>
                <div className="mt-auto pt-1">
                  <Change value={value} days={days} />
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function VisitorsCard({ analytics, days }: { analytics: SiteAnalytics; days: RangeDays }) {
  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-ink-soft font-medium">Visitors</h2>
          <p className="font-display text-6xl leading-none font-black tabular-nums">{count(analytics.visitors.now)}</p>
          <Change value={analytics.visitors} days={days} />
        </div>
        <dl className="flex flex-col gap-0.5 sm:items-end">
          <dt className="text-ink-faint text-sm">Pages viewed</dt>
          <dd className="text-2xl font-semibold tabular-nums">{count(analytics.pageviews.now)}</dd>
        </dl>
      </div>
      <VisitorsChart days={analytics.days} />
    </Card>
  );
}

export function RankedList({ title, rows, empty }: { title: string; rows: Ranked[]; empty: string }) {
  const top = Math.max(1, ...rows.map((row) => row.visitors));
  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-ink-faint">{empty}</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li key={row.label} className="relative isolate flex min-h-10 items-center justify-between gap-4 rounded-lg px-3">
              <span aria-hidden="true" className="bg-paper-shade absolute inset-y-0 left-0 -z-10 rounded-lg" style={{ width: `${(row.visitors / top) * 100}%` }} />
              <span className="min-w-0 truncate" title={row.label}>
                {row.label}
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {count(row.visitors)}
                <span className="sr-only"> visitors</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Last 7, 30 or 90 days, as links so the page stays a plain server render. */
export function RangePicker({ days, site }: { days: RangeDays; site?: string }) {
  return (
    <nav aria-label="Time period" className="bg-paper-shade flex rounded-full p-1">
      {RANGES.map((range) => {
        const current = range === days;
        const query = new URLSearchParams({ ...(site ? { site } : {}), days: String(range) });
        return (
          <Link
            key={range}
            href={`/portal?${query}`}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-9 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ink ${current ? "bg-surface text-ink shadow-card" : "text-ink-soft hover:text-ink"}`}
          >
            {range} days
          </Link>
        );
      })}
    </nav>
  );
}
