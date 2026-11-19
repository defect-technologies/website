import "server-only";
import { and, asc, desc, eq, exists, inArray, ne, notExists, sql } from "drizzle-orm";
import { ACTIVE_JOB_STATUSES } from "@/lib/previewJobs";
import { db } from "../db/client";
import { businesses, previewJobs, previewReviews, type Business } from "../db/schema";

export type ReviewItem = Pick<Business, "id" | "businessName" | "website" | "previewUrl" | "stage" | "previewBuiltAt" | "niche" | "area">;

const REVIEWABLE_STAGES = ["new", "preview_built"] as const;

const notReviewedYet = (database: Awaited<ReturnType<typeof db>>) =>
  notExists(
    database
      .select({ one: sql`1` })
      .from(previewReviews)
      .where(and(eq(previewReviews.businessId, businesses.id), eq(previewReviews.previewUrl, businesses.previewUrl))),
  );

/**
 * The runner built the preview the lead has. A founder's notes go back to the runner as a repair of its own copy of the
 * site, so a preview deployed by hand (Nikkei Nexus, from its own repository) or built on a laptop has nothing to
 * review here.
 */
const builtByTheRunner = (database: Awaited<ReturnType<typeof db>>) =>
  exists(
    database
      .select({ one: sql`1` })
      .from(previewJobs)
      .where(and(eq(previewJobs.businessId, businesses.id), eq(previewJobs.previewUrl, businesses.previewUrl), eq(previewJobs.status, "done"))),
  );

const notBuilding = (database: Awaited<ReturnType<typeof db>>) =>
  notExists(
    database
      .select({ one: sql`1` })
      .from(previewJobs)
      .where(and(eq(previewJobs.businessId, businesses.id), inArray(previewJobs.status, [...ACTIVE_JOB_STATUSES]))),
  );

/**
 * Built previews no founder or designer has reviewed yet, held ones first (the outside reviewer wanted changes, so they
 * wait on a review before outreach), then the newest. A preview leaves the queue once it's reviewed or while it
 * rebuilds. `among` keeps only those businesses: a designer's own.
 */
export async function reviewQueue(limit = 60, among?: string[]): Promise<ReviewItem[]> {
  if (among && !among.length) return [];
  const database = await db();
  return database
    .select({
      id: businesses.id,
      businessName: businesses.businessName,
      website: businesses.website,
      previewUrl: businesses.previewUrl,
      stage: businesses.stage,
      previewBuiltAt: businesses.previewBuiltAt,
      niche: businesses.niche,
      area: businesses.area,
    })
    .from(businesses)
    .where(and(ne(businesses.previewUrl, ""), inArray(businesses.stage, [...REVIEWABLE_STAGES]), notReviewedYet(database), notBuilding(database), builtByTheRunner(database), among ? inArray(businesses.id, among) : undefined))
    .orderBy(asc(sql`case when ${businesses.stage} = 'new' then 0 else 1 end`), desc(businesses.previewBuiltAt))
    .limit(limit);
}

export async function reviewQueueCount(): Promise<number> {
  const database = await db();
  const [row] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(businesses)
    .where(and(ne(businesses.previewUrl, ""), inArray(businesses.stage, [...REVIEWABLE_STAGES]), notReviewedYet(database), notBuilding(database), builtByTheRunner(database)));
  return row?.count ?? 0;
}
