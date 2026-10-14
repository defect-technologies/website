import "server-only";
import { desc, eq } from "drizzle-orm";
import { authorOf, describeChange, groupChanges } from "@/lib/siteChanges";
import { activityFor } from "../activity";
import { openFlags } from "../bots/flags";
import { db } from "../db/client";
import { clientSites, previewJobs, type Business, type ClientSite } from "../db/schema";
import { recentSiteChanges } from "../integrations/siteChanges";
import { brandFilesFor } from "../leads/brandFiles";
import { threadFor } from "../mail/threads";
import { buildFor, runnerStatus } from "../runner/status";
import { openSpotChecks } from "../spotChecks";

export type HistoryKind = "in" | "out" | "build" | "change" | "event";
export type HistoryItem = { key: string; at: Date; kind: HistoryKind; text: string; who: string };

async function siteFor(business: Business): Promise<ClientSite | null> {
  const rows = await (await db()).select().from(clientSites).where(eq(clientSites.businessId, business.id));
  if (rows[0]) return rows[0];
  const [bySlug] = await (await db()).select().from(clientSites).where(eq(clientSites.slug, business.slug));
  return bySlug ?? null;
}

async function jobsFor(businessId: string) {
  return (await db()).select().from(previewJobs).where(eq(previewJobs.businessId, businessId)).orderBy(desc(previewJobs.createdAt)).limit(50);
}

/** Edits to the live site, in the words the Site changes tab uses. Empty when the sites database isn't connected. */
async function changesFor(slug: string, ownerEmails: string[]): Promise<HistoryItem[]> {
  const result = await recentSiteChanges();
  if (result.state !== "ok") return [];
  const owners = new Set(ownerEmails.map((email) => email.toLowerCase()).filter(Boolean));
  return groupChanges(result.data.filter((change) => change.site === slug)).map((group) => {
    const author = authorOf(group.actor, owners);
    return { key: `change-${group.id}`, at: group.at, kind: "change", text: describeChange({ ...group, author }), who: "" };
  });
}

/** Everything about one business for its site page: the conversation, its build now and before, open flags and its history. */
export async function siteDetail(business: Business) {
  const [activity, thread, jobs, brand, site, flags, spotChecks, builds] = await Promise.all([
    activityFor(business.id),
    threadFor(business.id),
    jobsFor(business.id),
    brandFilesFor(business.id),
    siteFor(business),
    openFlags(),
    openSpotChecks(),
    runnerStatus(),
  ]);
  const changes = site ? await changesFor(site.slug, [site.ownerEmail, business.ownerEmail, business.email]) : [];
  const emails: HistoryItem[] = thread.map((message) => ({
    key: `mail-${message.id}`,
    at: message.at,
    kind: message.direction === "in" ? "in" : "out",
    text: message.direction === "in" ? message.body.slice(0, 160) : message.subject,
    who: message.direction === "in" ? "Them" : message.sentBy,
  }));
  const events: HistoryItem[] = activity
    .filter((entry) => !entry.action.startsWith("sent") && entry.action !== "replied")
    .map((entry) => ({ key: `event-${entry.id}`, at: entry.at, kind: entry.actor === "bot:runner" ? "build" : "event", text: entry.detail ? `${entry.action}: ${entry.detail}` : entry.action, who: entry.actor }));
  return {
    thread,
    jobs,
    brand,
    site,
    flags: flags.filter((row) => row.flag.businessId === business.id),
    spotChecks: spotChecks.filter((row) => row.check.businessId === business.id),
    build: buildFor(builds, business.id),
    now: builds.now,
    history: [...emails, ...events, ...changes].sort((a, b) => b.at.getTime() - a.at.getTime()),
  };
}

export type SiteDetail = Awaited<ReturnType<typeof siteDetail>>;
