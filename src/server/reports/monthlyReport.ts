import "server-only";
import { eq } from "drizzle-orm";
import { plural, reportBody } from "@/lib/monthlyReport";
import { totalActions } from "@/lib/siteAnalytics";
import { record } from "../activity";
import { db } from "../db/client";
import { settings } from "../db/schema";
import { siteName } from "../editor/signInLinks";
import { env } from "../env";
import { analyticsBetween, type Period } from "../integrations/webAnalytics";
import { deliver } from "../mail/outbox";
import { withTeamSignatureHtml } from "../mail/teamSignature";
import { STUDIO_NAME, studioMailboxId } from "../onboarding/welcome";
import { analyticsProject } from "../portal/context";
import { sitesWithProjects, type SiteWithProject } from "../sites/clientSites";

/** Below this many visitors in a month there's too little to say, so no email goes out. */
const MIN_VISITORS = 30;

const monthName = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** The calendar month before `now`, and the month before that. */
function lastTwoMonths(now: Date): { current: Period; previous: Period; label: string; earlier: string; key: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const previousStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  const previousEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 0));
  return {
    current: { since: isoDay(start), until: isoDay(end) },
    previous: { since: isoDay(previousStart), until: isoDay(previousEnd) },
    label: monthName.format(start),
    earlier: monthName.format(previousStart),
    key: isoDay(start).slice(0, 7),
  };
}

async function sentThisMonth(key: string): Promise<Set<string>> {
  const [row] = await (await db()).select().from(settings).where(eq(settings.key, `report.monthly.${key}`));
  return new Set((row?.value as string[] | undefined) ?? []);
}

async function saveSent(key: string, slugs: Set<string>) {
  const value = [...slugs];
  await (await db())
    .insert(settings)
    .values({ key: `report.monthly.${key}`, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

type Outcome = "sent" | "quiet" | "unavailable" | "failed";

async function reportOne(site: SiteWithProject, month: ReturnType<typeof lastTwoMonths>): Promise<Outcome> {
  const analytics = await analyticsBetween(analyticsProject(site), month.current, month.previous);
  if (analytics.state !== "ok") return "unavailable";
  if (analytics.data.visitors.now < MIN_VISITORS) return "quiet";
  const body = reportBody(analytics.data, {
    firstName: site.ownerFirstName,
    siteName: siteName(site.businessName, site.url),
    dashboardUrl: new URL("/portal", env.siteUrl()).toString(),
    month: month.label,
    earlier: month.earlier,
  });
  const subject = `Your website in ${month.label}: ${plural(totalActions(analytics.data).now, "person", "people")} reached you`;
  try {
    await deliver((from) => ({ from: { name: STUDIO_NAME, email: from?.email ?? "outbox@dev.localhost" }, to: site.ownerEmail, subject, body, html: withTeamSignatureHtml(body) }), await studioMailboxId());
    await record("monthly report", "sent the monthly report", { businessId: site.businessId, detail: `${month.label} to ${site.ownerEmail}` });
    return "sent";
  } catch (error) {
    await record("monthly report", "monthly report failed", { businessId: site.businessId, detail: (error as Error).message });
    return "failed";
  }
}

/**
 * On the 1st, emails each live site's owner what last month brought: who reached them and how, visitors,
 * the top source, and anything that needs a look. Sites with fewer than 30 visitors get nothing. Each site
 * is emailed at most once a month, even if the job runs again.
 */
export async function sendMonthlyReports(now = new Date()): Promise<Record<string, Outcome>> {
  const month = lastTwoMonths(now);
  const sent = await sentThisMonth(month.key);
  const outcomes: Record<string, Outcome> = {};
  for (const site of await sitesWithProjects()) {
    if (sent.has(site.slug)) continue;
    outcomes[site.slug] = await reportOne(site, month);
    if (outcomes[site.slug] === "sent") sent.add(site.slug);
  }
  await saveSent(month.key, sent);
  return outcomes;
}
