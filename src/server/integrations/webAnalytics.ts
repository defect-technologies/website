import "server-only";
import { ACTIONS, type Action, type Compared, type Day, type RangeDays, type Ranked, type SiteAnalytics, type WeekGrid } from "@/lib/siteAnalytics";
import { env } from "../env";
import { integration, type Integration } from "./result";

const API = "https://api.vercel.com/v1/query/web-analytics";
const CACHE_SECONDS = 600;
const DAY_MS = 24 * 60 * 60 * 1000;

type Row = Record<string, string | number | null | undefined>;
export type Period = { since: string; until: string };
type Query = { dataset: "visits" | "events"; by: string; period: Period; limit?: number; filter?: string };

/** Every client is a Los Angeles business for now; the busiest-times grid reads hours in this zone. */
const BUSINESS_TIME_ZONE = "America/Los_Angeles";
const ACTION_FILTER = `eventName in (${ACTIONS.map((action) => `'${action}'`).join(",")})`;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** The last `days` days through today, and the same number of days before that. */
function periods(days: RangeDays, now = new Date()): { current: Period; previous: Period } {
  const until = new Date(now);
  const since = new Date(now.getTime() - (days - 1) * DAY_MS);
  const previousUntil = new Date(since.getTime() - DAY_MS);
  const previousSince = new Date(previousUntil.getTime() - (days - 1) * DAY_MS);
  return { current: { since: isoDay(since), until: isoDay(until) }, previous: { since: isoDay(previousSince), until: isoDay(previousUntil) } };
}

/** Web Analytics was never switched on for the project, so there is nothing to count yet. */
class AnalyticsOff extends Error {}

async function query(projectId: string, { dataset, by, period, limit, filter }: Query): Promise<Row[]> {
  const { token, teamId } = env.vercel();
  const params = new URLSearchParams({ projectId, teamId, by, since: period.since, until: period.until, ...(limit ? { limit: String(limit) } : {}), ...(filter ? { filter } : {}) });
  const response = await fetch(`${API}/${dataset}/aggregate?${params}`, { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: CACHE_SECONDS } });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200);
    if (detail.includes("web_analytics_not_enabled")) throw new AnalyticsOff(projectId);
    throw new Error(`Vercel Web Analytics answered ${response.status}: ${detail}`);
  }
  const body = (await response.json()) as { data?: Row[] };
  return Array.isArray(body.data) ? body.data : [];
}

const numberOf = (row: Row | undefined, field: string) => Number(row?.[field] ?? 0) || 0;
const sum = (rows: Row[], field: string) => rows.reduce((total, row) => total + numberOf(row, field), 0);

/** One row per day in the range, with zeros for days Vercel left out. */
function fillDays(rows: Row[], period: Period): Day[] {
  const byDate = new Map(rows.map((row) => [String(row.timestamp ?? "").slice(0, 10), row]));
  const days: Day[] = [];
  for (let time = Date.parse(period.since); time <= Date.parse(period.until); time += DAY_MS) {
    const date = isoDay(new Date(time));
    const row = byDate.get(date);
    days.push({ date, visitors: numberOf(row, "visitors"), pageviews: numberOf(row, "pageviews") });
  }
  return days;
}

function actionCounts(now: Row[], before: Row[]): Record<Action, Compared> {
  const countOf = (rows: Row[], action: Action) => numberOf(rows.find((row) => row.eventName === action), "count");
  return Object.fromEntries(ACTIONS.map((action) => [action, { now: countOf(now, action), before: countOf(before, action) }])) as Record<Action, Compared>;
}

const SOURCE_NAMES: [RegExp, string][] = [
  [/(^|\.)google\./, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)(facebook|fb)\.com$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)yelp\.com$/, "Yelp"],
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/, "ChatGPT"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
];

/** "www.google.com" reads as "Google"; no referrer ("direct" from site-kit) means the visitor typed the address or used a bookmark. */
export function sourceName(hostname: string): string {
  const host = hostname.trim().toLowerCase().replace(/^www\./, "");
  if (!host || host === "direct") return "Typed in or bookmarked";
  return SOURCE_NAMES.find(([pattern]) => pattern.test(host))?.[1] ?? host;
}

const pageName = (path: string) => (!path || path === "/" ? "Home page" : path);

/** Rows grouped by `field`, merged under their readable label and counted by `metric`, top five first. */
function ranked(rows: Row[], field: string, label: (value: string) => string, metric = "visitors"): Ranked[] {
  const merged = new Map<string, number>();
  for (const row of rows) {
    const value = String(row[field] ?? "");
    if (value === "Others") continue;
    const name = label(value);
    merged.set(name, (merged.get(name) ?? 0) + numberOf(row, metric));
  }
  return [...merged].map(([name, count]) => ({ label: name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
}

const hourParts = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIME_ZONE, weekday: "short", hour: "numeric", hourCycle: "h23" });
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Hourly visitor rows folded into one week: visitors by weekday and hour, in the business's time zone. */
function weekGrid(rows: Row[]): WeekGrid {
  const grid = WEEKDAYS.map(() => Array.from({ length: 24 }, () => 0));
  for (const row of rows) {
    const time = new Date(String(row.timestamp ?? ""));
    if (Number.isNaN(time.getTime())) continue;
    const parts = Object.fromEntries(hourParts.formatToParts(time).map((part) => [part.type, part.value]));
    grid[WEEKDAYS.indexOf(parts.weekday)][Number(parts.hour) % 24] += numberOf(row, "visitors");
  }
  return grid;
}

const nothing: Compared = { now: 0, before: 0 };

/** Every chart and count at zero, for a site whose visits aren't being counted yet. */
function emptyAnalytics(period: Period): SiteAnalytics {
  return {
    days: fillDays([], period),
    visitors: nothing,
    pageviews: nothing,
    actions: Object.fromEntries(ACTIONS.map((action) => [action, nothing])) as Record<Action, Compared>,
    pages: [],
    sources: [],
    actionPages: [],
    actionSources: [],
    week: weekGrid([]),
  };
}

/** Visitors, taps and where they came from in `current`, compared with `previous`. A project with analytics off reads as all zeros. */
async function load(projectId: string, current: Period, previous: Period): Promise<SiteAnalytics> {
  try {
    return await loadCounts(projectId, current, previous);
  } catch (error) {
    if (!(error instanceof AnalyticsOff)) throw error;
    console.warn(`[analytics] Web Analytics is off for ${projectId}. Switch it on in the project's Analytics tab on Vercel, then redeploy.`);
    return emptyAnalytics(current);
  }
}

async function loadCounts(projectId: string, current: Period, previous: Period): Promise<SiteAnalytics> {
  const [daily, total, totalBefore, events, eventsBefore, pages, sources, actionPages, actionSources, hourly] = await Promise.all([
    query(projectId, { dataset: "visits", by: "day", period: current }),
    query(projectId, { dataset: "visits", by: "environment", period: current }),
    query(projectId, { dataset: "visits", by: "environment", period: previous }),
    query(projectId, { dataset: "events", by: "eventName", period: current, limit: 20 }),
    query(projectId, { dataset: "events", by: "eventName", period: previous, limit: 20 }),
    query(projectId, { dataset: "visits", by: "requestPath", period: current, limit: 10 }),
    query(projectId, { dataset: "visits", by: "referrerHostname", period: current, limit: 10 }),
    query(projectId, { dataset: "events", by: "eventData/page", period: current, limit: 10, filter: ACTION_FILTER }),
    query(projectId, { dataset: "events", by: "eventData/source", period: current, limit: 10, filter: ACTION_FILTER }),
    query(projectId, { dataset: "visits", by: "hour", period: current }),
  ]);
  return {
    days: fillDays(daily, current),
    visitors: { now: sum(total, "visitors"), before: sum(totalBefore, "visitors") },
    pageviews: { now: sum(total, "pageviews"), before: sum(totalBefore, "pageviews") },
    actions: actionCounts(events, eventsBefore),
    pages: ranked(pages, "requestPath", pageName),
    sources: ranked(sources, "referrerHostname", sourceName),
    actionPages: ranked(actionPages, "eventData", pageName, "count"),
    actionSources: ranked(actionSources, "eventData", sourceName, "count"),
    week: weekGrid(hourly),
  };
}

/**
 * Events Vercel bills for on one project between two days: page views plus tracked clicks.
 * `off` says Web Analytics was never switched on, so nothing is being counted.
 */
export async function billableEvents(projectId: string, since: string, until: string): Promise<{ events: number; off: boolean }> {
  const period = { since, until };
  try {
    const [visits, events] = await Promise.all([
      query(projectId, { dataset: "visits", by: "environment", period }),
      query(projectId, { dataset: "events", by: "eventName", period, limit: 100 }),
    ]);
    return { events: sum(visits, "pageviews") + sum(events, "count"), off: false };
  } catch (error) {
    if (error instanceof AnalyticsOff) return { events: 0, off: true };
    throw error;
  }
}

/** A live site's visitors and clicks over the last `days` days, cached for ten minutes. */
export function siteAnalytics(projectId: string, days: RangeDays): Promise<Integration<SiteAnalytics>> {
  const { current, previous } = periods(days);
  return analyticsBetween(projectId, current, previous);
}

/** The same numbers for any two periods, such as last month against the month before. */
export function analyticsBetween(projectId: string, current: Period, previous: Period): Promise<Integration<SiteAnalytics>> {
  const { token, teamId } = env.vercel();
  return integration({ VERCEL_TOKEN: token, VERCEL_TEAM_ID: teamId }, () => load(projectId, current, previous));
}
