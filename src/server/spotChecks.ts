import "server-only";
import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { DEFAULT_SPOT_CHECK_SETTINGS, type SpotCheckSettings } from "@/lib/spotChecks";
import { record } from "./activity";
import { db } from "./db/client";
import { businesses, settings, spotChecks, type Business, type SpotCheck } from "./db/schema";

const SETTINGS_KEY = "spot_checks";

export async function spotCheckSettings(): Promise<SpotCheckSettings> {
  const [row] = await (await db()).select().from(settings).where(eq(settings.key, SETTINGS_KEY));
  return { ...DEFAULT_SPOT_CHECK_SETTINGS, ...((row?.value as Partial<SpotCheckSettings>) ?? {}) };
}

export async function saveSpotCheckSettings(value: SpotCheckSettings, updatedBy: string) {
  const now = new Date();
  await (await db())
    .insert(settings)
    .values({ key: SETTINGS_KEY, value, updatedBy, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy, updatedAt: now } });
}

/**
 * Called when a preview finishes building. Picks it for a spot check at the share set on
 * the Spot checks page. A preview is picked at most once, however often it's reported.
 */
export async function maybePickForSpotCheck(lead: Business, previewUrl: string, jobId: string | null, actor: string, random = Math.random) {
  const { share } = await spotCheckSettings();
  if (share <= 0 || random() >= share) return false;
  const [picked] = await (await db())
    .insert(spotChecks)
    .values({ businessId: lead.id, jobId, previewUrl })
    .onConflictDoNothing()
    .returning({ id: spotChecks.id });
  if (picked) await record(actor, "picked a preview for a spot check", { businessId: lead.id, detail: previewUrl });
  return Boolean(picked);
}

export type SpotCheckRow = { check: SpotCheck; businessName: string; slug: string };

const withBusiness = { check: spotChecks, businessName: businesses.businessName, slug: businesses.slug };

/** Spot checks waiting for a founder, oldest first so none sits until its preview expires. */
export async function openSpotChecks(): Promise<SpotCheckRow[]> {
  return (await db())
    .select(withBusiness)
    .from(spotChecks)
    .innerJoin(businesses, eq(spotChecks.businessId, businesses.id))
    .where(eq(spotChecks.status, "open"))
    .orderBy(spotChecks.sampledAt);
}

export async function openSpotCheckCount(): Promise<number> {
  const [row] = await (await db()).select({ count: count() }).from(spotChecks).where(eq(spotChecks.status, "open"));
  return row?.count ?? 0;
}

/** Rated spot checks, newest first. */
export async function reviewedSpotChecks(limit = 100): Promise<SpotCheckRow[]> {
  return (await db())
    .select(withBusiness)
    .from(spotChecks)
    .innerJoin(businesses, eq(spotChecks.businessId, businesses.id))
    .where(eq(spotChecks.status, "done"))
    .orderBy(desc(spotChecks.reviewedAt))
    .limit(limit);
}

export type SpotCheckAverages = { checks: number; copy: number | null; typography: number | null; layout: number | null };

/** Average ratings over the last `days` days. */
export async function spotCheckAverages(days = 30): Promise<SpotCheckAverages> {
  const since = new Date(Date.now() - days * 86_400_000);
  const [row] = await (await db())
    .select({
      checks: count(),
      copy: sql<number | null>`avg(${spotChecks.copyRating})::float`,
      typography: sql<number | null>`avg(${spotChecks.typographyRating})::float`,
      layout: sql<number | null>`avg(${spotChecks.layoutRating})::float`,
    })
    .from(spotChecks)
    .where(and(eq(spotChecks.status, "done"), isNotNull(spotChecks.reviewedAt), gte(spotChecks.reviewedAt, since)));
  return { checks: row?.checks ?? 0, copy: row?.copy ?? null, typography: row?.typography ?? null, layout: row?.layout ?? null };
}

export type SpotCheckReview = { copyRating: number; typographyRating: number; layoutRating: number; note: string };

export async function saveSpotCheckReview(id: string, review: SpotCheckReview, reviewer: string) {
  const [saved] = await (await db())
    .update(spotChecks)
    .set({ ...review, status: "done", reviewedBy: reviewer, reviewedAt: new Date() })
    .where(eq(spotChecks.id, id))
    .returning();
  return saved ?? null;
}

export async function skipSpotCheck(id: string, reviewer: string) {
  const [skipped] = await (await db())
    .update(spotChecks)
    .set({ status: "skipped", reviewedBy: reviewer, reviewedAt: new Date() })
    .where(and(eq(spotChecks.id, id), eq(spotChecks.status, "open")))
    .returning();
  return skipped ?? null;
}

/** GET /api/runner/spot-checks: what founders said about past previews, for the builder to learn from. */
export async function spotCheckNotes(since: Date | null, limit: number) {
  const rows = await (await db())
    .select(withBusiness)
    .from(spotChecks)
    .innerJoin(businesses, eq(spotChecks.businessId, businesses.id))
    .where(and(eq(spotChecks.status, "done"), since ? gte(spotChecks.reviewedAt, since) : undefined))
    .orderBy(desc(spotChecks.reviewedAt))
    .limit(limit);
  return rows.map(({ check, businessName, slug }) => ({
    id: check.id,
    slug,
    businessName,
    previewUrl: check.previewUrl,
    ratings: { copy: check.copyRating, typography: check.typographyRating, layout: check.layoutRating },
    note: check.note,
    reviewedBy: check.reviewedBy,
    reviewedAt: check.reviewedAt?.toISOString() ?? null,
  }));
}
