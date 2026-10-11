import "server-only";
import { eq } from "drizzle-orm";
import { raiseFlag } from "../bots/flags";
import { db } from "../db/client";
import { settings } from "../db/schema";
import { emailFounders } from "../flags/notify";
import { billableEvents } from "../integrations/webAnalytics";
import { analyticsProject } from "../portal/context";
import { sitesWithProjects } from "../sites/clientSites";

/** Vercel Pro's price for Web Analytics, and the monthly spend the founders want to hear about. */
const DOLLARS_PER_THOUSAND_EVENTS = 0.03;
const ALERT_AT_DOLLARS = 10;
const ALERTED_KEY = "alert.analytics-spend";
const FLAGGED_OFF_KEY = "alert.analytics-off";

const dollars = (events: number) => (events / 1000) * DOLLARS_PER_THOUSAND_EVENTS;
const money = (amount: number) => `$${amount.toFixed(2)}`;

type Site = Awaited<ReturnType<typeof sitesWithProjects>>[number];
type Count = { site: Site; events: number; off: boolean };

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await (await db()).select().from(settings).where(eq(settings.key, key));
  return (row?.value as T | undefined) ?? fallback;
}

async function saveSetting(key: string, value: unknown) {
  await (await db())
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

/** One review-queue card per live site whose visits aren't being counted, raised again only if it's switched off after being on. */
async function flagSitesWithAnalyticsOff(counts: Count[]) {
  const flagged = new Set(await readSetting<string[]>(FLAGGED_OFF_KEY, []));
  for (const { site, off } of counts) {
    if (!off) flagged.delete(site.slug);
    if (!off || flagged.has(site.slug)) continue;
    await raiseFlag("overseer", site.businessId, {
      headline: `Visits to ${site.businessName || site.slug}'s website aren't being counted`,
      needs: "fix",
      ask: `In Vercel, open the ${analyticsProject(site)} project, choose Analytics, click Enable (standard, not Plus), then redeploy the site.`,
      options: [],
      fixer: "either",
      topic: "launch",
      urgent: false,
      details: "Web Analytics is off for this project, so the client's portal dashboard and monthly report stay empty. Vercel has no API to switch it on, so a launch can't do it.",
    });
    flagged.add(site.slug);
  }
  await saveSetting(FLAGGED_OFF_KEY, [...flagged]);
}

async function emailSpend(month: string, counts: Count[], events: number) {
  const lines = counts
    .filter((count) => count.events > 0)
    .sort((a, b) => b.events - a.events)
    .map((count) => `- ${count.site.slug}: ${count.events.toLocaleString("en-US")} events, about ${money(dollars(count.events))}`);
  await emailFounders(
    `Web Analytics is over ${money(ALERT_AT_DOLLARS)} this month`,
    [
      `Web Analytics has collected ${events.toLocaleString("en-US")} events across our client sites so far in ${month}, about ${money(dollars(events))} at Vercel's $0.03 per 1,000.`,
      "",
      "By site:",
      ...lines,
      "",
      "This is an estimate from the event counts. The exact charge is on Vercel's Usage page, under Observability.",
      "You'll hear about this once a month at most.",
    ].join("\n"),
  );
}

export type SpendCheck = { month: string; events: number; estimate: number; alerted: boolean; analyticsOff: string[] };

/**
 * Every morning: estimates this month's Web Analytics bill from the events every client site has collected,
 * emails the founders the first time in a month it passes $10 (Vercel's own alerts only see the whole bill),
 * and flags any live site whose visits aren't being counted.
 */
export async function checkAnalyticsSpend(now = new Date()): Promise<SpendCheck> {
  const month = now.toISOString().slice(0, 7);
  const sites = await sitesWithProjects();
  const counts: Count[] = await Promise.all(sites.map(async (site) => ({ site, ...(await billableEvents(analyticsProject(site), `${month}-01`, now.toISOString().slice(0, 10))) })));
  await flagSitesWithAnalyticsOff(counts);
  const events = counts.reduce((total, count) => total + count.events, 0);
  const estimate = dollars(events);
  const alerted = estimate >= ALERT_AT_DOLLARS && (await readSetting(ALERTED_KEY, "")) !== month;
  if (alerted) {
    await emailSpend(month, counts, events);
    await saveSetting(ALERTED_KEY, month);
  }
  return { month, events, estimate, alerted, analyticsOff: counts.filter((count) => count.off).map((count) => count.site.slug) };
}
