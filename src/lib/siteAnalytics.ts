/** What a live site's owner sees on their portal dashboard and in their monthly report, from Vercel Web Analytics. Shared by the server and the browser. */

export const ACTIONS = ["Call", "Directions", "Email", "Book"] as const;
export type Action = (typeof ACTIONS)[number];

export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];
export const DEFAULT_RANGE: RangeDays = 30;

export type Day = { date: string; visitors: number; pageviews: number };
/** A page, a source, or anything else ranked by how many visitors or taps it had. */
export type Ranked = { label: string; count: number };
export type Compared = { now: number; before: number };

/** Visitors by weekday (0 is Sunday) and hour of the day, in the business's time zone. */
export type WeekGrid = number[][];

export type SiteAnalytics = {
  days: Day[];
  visitors: Compared;
  pageviews: Compared;
  actions: Record<Action, Compared>;
  pages: Ranked[];
  sources: Ranked[];
  /** Where people tapped to call, email, get directions or book. */
  actionPages: Ranked[];
  /** Where the visits that ended in a tap came from. */
  actionSources: Ranked[];
  week: WeekGrid;
};

export const parseRange = (value: string | undefined): RangeDays => {
  const days = Number(value);
  return (RANGES as readonly number[]).includes(days) ? (days as RangeDays) : DEFAULT_RANGE;
};

export const totalActions = (analytics: Pick<SiteAnalytics, "actions">): Compared =>
  ACTIONS.reduce((sum, action) => ({ now: sum.now + analytics.actions[action].now, before: sum.before + analytics.actions[action].before }), { now: 0, before: 0 });

export const hasAnyData = (analytics: SiteAnalytics) => analytics.visitors.now > 0 || analytics.visitors.before > 0 || totalActions(analytics).now > 0;

export type Insight = { tone: "attention" | "opportunity" | "good"; title: string; detail: string };

const percent = (part: number, whole: number) => Math.round((part / whole) * 100);

function attention(analytics: SiteAnalytics, days: number): Insight[] {
  const reached = totalActions(analytics);
  const found: Insight[] = [];
  if (reached.now === 0 && reached.before >= 3) {
    found.push({ tone: "attention", title: `No one reached you in the last ${days} days`, detail: `${reached.before} people called, emailed, asked for directions or booked in the ${days} days before. Check that your phone number and booking link still work.` });
  }
  const visitors = analytics.visitors;
  if (visitors.before >= 30 && visitors.now <= visitors.before * 0.6) {
    found.push({ tone: "attention", title: `Visits fell ${100 - percent(visitors.now, visitors.before)}%`, detail: `${visitors.now} people visited, down from ${visitors.before} in the ${days} days before.` });
  }
  return found;
}

/** A page many people read but no one reaches out from: the place to add a call or booking button. */
function quietPage(analytics: SiteAnalytics): Insight[] {
  const busy = new Set(analytics.actionPages.map((page) => page.label));
  const page = analytics.pages.find((candidate) => candidate.count >= 20 && !busy.has(candidate.label) && candidate.label !== "Home page");
  if (!page || totalActions(analytics).now === 0) return [];
  return [{ tone: "opportunity", title: `People read ${page.label} but don't reach out from it`, detail: `${page.count} people visited it, and none of them called, emailed or booked from there. Ask us to add a call or booking button to it.` }];
}

function goodNews(analytics: SiteAnalytics, days: number): Insight[] {
  const reached = totalActions(analytics);
  const found: Insight[] = [];
  if (reached.now >= 5 && reached.now >= reached.before * 1.25) {
    found.push({ tone: "good", title: `${reached.now - reached.before} more people reached you`, detail: `${reached.now} in the last ${days} days, up from ${reached.before}.` });
  }
  const top = analytics.actionSources[0];
  if (top && reached.now >= 5 && top.count >= reached.now / 2) {
    found.push({ tone: "good", title: `${top.label} brings most of your customers`, detail: `${top.count} of the ${reached.now} people who reached you came from ${top.label}.` });
  }
  return found;
}

/** Up to three plain-language findings, most urgent first. Quiet sites get none rather than noise. */
export function insights(analytics: SiteAnalytics, days: number): Insight[] {
  return [...attention(analytics, days), ...quietPage(analytics), ...goodNews(analytics, days)].slice(0, 3);
}
