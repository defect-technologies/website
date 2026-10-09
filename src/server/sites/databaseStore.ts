import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { SiteContent } from "@/lib/siteContent";
import { db } from "../db/client";
import { siteVersions, sites, type Site } from "../db/schema";
import type { SaveRequest, SaveResult, SiteStore, StoredSite } from "./store";

function toStored(row: Site): StoredSite {
  const content = row.content as SiteContent;
  return {
    slug: row.slug,
    businessId: row.businessId,
    ownerEmail: row.ownerEmail,
    businessName: content.business.name,
    content,
    assetBaseUrl: row.assetBaseUrl,
    liveUrl: row.liveUrl,
    version: row.version,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

async function siteRow(slug: string) {
  const [row] = await (await db()).select().from(sites).where(eq(sites.slug, slug));
  return row ?? null;
}

/**
 * Sites in Postgres. neon-http has no transactions, so a save claims the next
 * version number first (unique per site), then moves the site forward only if
 * nobody else did in between.
 */
export const databaseSiteStore: SiteStore = {
  async allSites() {
    const rows = await (await db()).select().from(sites).orderBy(sites.slug);
    return rows.map(toStored);
  },

  async sitesFor(ownerEmail) {
    const rows = await (await db()).select().from(sites).where(eq(sites.ownerEmail, ownerEmail.toLowerCase())).orderBy(sites.slug);
    return rows.map(toStored);
  },

  async site(slug) {
    const row = await siteRow(slug);
    return row ? toStored(row) : null;
  },

  async save({ slug, baseVersion, content, summary, savedBy }: SaveRequest): Promise<SaveResult> {
    const database = await db();
    const row = await siteRow(slug);
    if (!row) return { ok: false, reason: "not-found" };
    if (row.version !== baseVersion) return { ok: false, reason: "stale" };
    const version = baseVersion + 1;
    const claimed = await database.insert(siteVersions).values({ siteId: row.id, version, content, summary, savedBy }).onConflictDoNothing().returning({ id: siteVersions.id });
    if (claimed.length === 0) return { ok: false, reason: "stale" };
    await database
      .update(sites)
      .set({ content, version, updatedAt: new Date(), updatedBy: savedBy })
      .where(and(eq(sites.id, row.id), eq(sites.version, baseVersion)));
    return { ok: true, version };
  },

  async versions(slug) {
    const row = await siteRow(slug);
    if (!row) return [];
    return (await db())
      .select({ version: siteVersions.version, summary: siteVersions.summary, savedBy: siteVersions.savedBy, savedAt: siteVersions.savedAt })
      .from(siteVersions)
      .where(eq(siteVersions.siteId, row.id))
      .orderBy(desc(siteVersions.version))
      .limit(100);
  },

  async versionContent(slug, version) {
    const row = await siteRow(slug);
    if (!row) return null;
    const [saved] = await (await db())
      .select({ content: siteVersions.content })
      .from(siteVersions)
      .where(and(eq(siteVersions.siteId, row.id), eq(siteVersions.version, version)));
    return (saved?.content as SiteContent | undefined) ?? null;
  },
};

/** Adds a site with its first version. Used by the local sample today and by onboarding later. */
export async function createSite(input: { slug: string; ownerEmail: string; content: SiteContent; businessId?: string | null; assetBaseUrl?: string; liveUrl?: string; createdBy: string }) {
  const database = await db();
  const [row] = await database
    .insert(sites)
    .values({
      slug: input.slug,
      ownerEmail: input.ownerEmail.toLowerCase(),
      content: input.content,
      businessId: input.businessId ?? null,
      assetBaseUrl: input.assetBaseUrl ?? "",
      liveUrl: input.liveUrl ?? "",
      version: 1,
      updatedBy: input.createdBy,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) return null;
  await database.insert(siteVersions).values({ siteId: row.id, version: 1, content: input.content, summary: "First version", savedBy: input.createdBy });
  return toStored(row);
}
