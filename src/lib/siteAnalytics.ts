/** What a live site's owner sees on their portal dashboard, from Vercel Web Analytics. Shared by the server and the chart. */

export const ACTIONS = ["Call", "Directions", "Email", "Book"] as const;
export type Action = (typeof ACTIONS)[number];

export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];
export const DEFAULT_RANGE: RangeDays = 30;

export type Day = { date: string; visitors: number; pageviews: number };
export type Ranked = { label: string; visitors: number };
export type Compared = { now: number; before: number };

export type SiteAnalytics = {
  days: Day[];
  visitors: Compared;
  pageviews: Compared;
  actions: Record<Action, Compared>;
  pages: Ranked[];
  sources: Ranked[];
};

export const parseRange = (value: string | undefined): RangeDays => {
  const days = Number(value);
  return (RANGES as readonly number[]).includes(days) ? (days as RangeDays) : DEFAULT_RANGE;
};

export const hasAnyData = (analytics: SiteAnalytics) => analytics.visitors.now > 0 || analytics.visitors.before > 0 || ACTIONS.some((action) => analytics.actions[action].now > 0);
