import type { Icon } from "@phosphor-icons/react";
import { ArrowDownRight, ArrowUpRight, CalendarCheck, EnvelopeSimple, Lightbulb, MapPin, Phone, TrendUp, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Card } from "@/components/admin/ui";
import { ACTIONS, RANGES, totalActions, type Action, type Compared, type Insight, type RangeDays, type Ranked, type SiteAnalytics, type WeekGrid } from "@/lib/siteAnalytics";
import VisitorsChart from "./VisitorsChart";

const ACTION_COPY: Record<Action, { label: string; icon: Icon }> = {
  Call: { label: "Calls", icon: Phone },
  Directions: { label: "Directions", icon: MapPin },
  Email: { label: "Emails", icon: EnvelopeSimple },
  Book: { label: "Bookings", icon: CalendarCheck },
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

const INSIGHT_LOOK: Record<Insight["tone"], { icon: Icon; className: string }> = {
  attention: { icon: Warning, className: "text-warn" },
  opportunity: { icon: Lightbulb, className: "text-ink" },
  good: { icon: TrendUp, className: "text-good" },
};

/** The few things worth reading first, each a sentence and what to do about it. */
export function InsightCards({ items }: { items: Insight[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="What to know" className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]">
      {items.map((item) => {
        const { icon: InsightIcon, className } = INSIGHT_LOOK[item.tone];
        return (
          <Card key={item.title} className="flex gap-3 p-5">
            <InsightIcon size={22} weight="fill" aria-hidden="true" className={`mt-0.5 shrink-0 ${className}`} />
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold text-balance">{item.title}</h2>
              <p className="text-ink-soft text-sm text-pretty">{item.detail}</p>
            </div>
          </Card>
        );
      })}
    </section>
  );
}

/** The number owners care about most, with how it breaks down beneath it. */
export function ReachedYou({ analytics, days }: { analytics: SiteAnalytics; days: RangeDays }) {
  const total = totalActions(analytics);
  return (
    <section aria-labelledby="reached-you" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id="reached-you" className="text-lg font-semibold">
          People who reached you
        </h2>
        <ComparedWith days={days} />
      </div>
      <Card className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:gap-10">
        <div className="flex shrink-0 flex-col gap-1">
          <p className="font-display text-8xl leading-none font-black tabular-nums">{count(total.now)}</p>
          <Change value={total} days={days} />
        </div>
        <ul className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {ACTIONS.map((action) => {
            const { label, icon: ActionIcon } = ACTION_COPY[action];
            const value = analytics.actions[action];
            return (
              <li key={action} className="flex flex-col gap-1">
                <p className="text-ink-soft flex items-center gap-2 font-medium">
                  <ActionIcon size={20} aria-hidden="true" />
                  {label}
                </p>
                <p className="text-3xl font-semibold tabular-nums">{count(value.now)}</p>
                <Change value={value} days={days} />
              </li>
            );
          })}
        </ul>
      </Card>
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

export function RankedList({ title, rows, unit, empty = "No data yet" }: { title: string; rows: Ranked[]; unit: string; empty?: string }) {
  const top = Math.max(1, ...rows.map((row) => row.count));
  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-ink-faint">{empty}</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li key={row.label} className="relative isolate flex min-h-10 items-center justify-between gap-4 rounded-lg px-3">
              <span aria-hidden="true" className="bg-paper-shade absolute inset-y-0 left-0 -z-10 rounded-lg" style={{ width: `${(row.count / top) * 100}%` }} />
              <span className="min-w-0 truncate" title={row.label}>
                {row.label}
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {count(row.count)}
                <span className="sr-only"> {unit}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

const DAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const AXIS_HOURS = [0, 6, 12, 18];

const hourName = (hour: number) => (hour === 0 ? "midnight" : hour === 12 ? "noon" : hour < 12 ? `${hour} a.m.` : `${hour - 12} p.m.`);

/** "Saturdays around 11 a.m.", from the busiest cell of the week. */
function busiest(week: WeekGrid): string | null {
  const cells = week.flatMap((hours, day) => hours.map((visitors, hour) => ({ day, hour, visitors })));
  const best = cells.reduce((top, cell) => (cell.visitors > top.visitors ? cell : top), { day: 0, hour: 0, visitors: 0 });
  return best.visitors > 0 ? `${DAY_NAMES[best.day]} around ${hourName(best.hour)}` : null;
}

/** Visitors by weekday and hour, darker where it's busier: when to answer the phone. */
export function BusiestTimes({ week }: { week: WeekGrid }) {
  const peak = Math.max(1, ...week.flat());
  const summary = busiest(week);
  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="text-lg font-semibold">Busiest times</h2>
        <p className="text-ink-soft text-sm">{summary ? `Most visits: ${summary}` : "No data yet"}</p>
      </div>
      <div role="img" aria-label={summary ? `Visitors by day and hour. Busiest: ${summary}.` : "No visits yet."} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 gap-y-1">
        {week.map((hours, day) => (
          <div key={DAY_SHORT[day]} className="contents">
            <span aria-hidden="true" className="text-ink-faint text-xs leading-5">
              {DAY_SHORT[day]}
            </span>
            <div aria-hidden="true" className="grid grid-cols-24 gap-0.5">
              {hours.map((visitors, hour) => (
                <span key={hour} className="bg-paper-shade relative h-5 overflow-hidden rounded-[3px]">
                  <span className="bg-ink absolute inset-0" style={{ opacity: visitors / peak }} />
                </span>
              ))}
            </div>
          </div>
        ))}
        <span aria-hidden="true" />
        <div aria-hidden="true" className="text-ink-faint grid grid-cols-4 text-xs">
          {AXIS_HOURS.map((hour) => (
            <span key={hour}>{hourName(hour)}</span>
          ))}
        </div>
      </div>
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
