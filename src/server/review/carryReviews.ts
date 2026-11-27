import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { previewReviews } from "../db/schema";

/**
 * A preview deployed again unchanged keeps what founders said about it: an approval still lets its first email go,
 * and notes still wait on the site. Each review of the old address is copied to the new one.
 */
export async function carryReviews(businessId: string, fromUrl: string, toUrl: string): Promise<number> {
  const database = await db();
  const reviews = await database
    .select()
    .from(previewReviews)
    .where(and(eq(previewReviews.businessId, businessId), eq(previewReviews.previewUrl, fromUrl)));
  if (reviews.length === 0) return 0;
  await database.insert(previewReviews).values(reviews.map((review) => ({ businessId: review.businessId, previewUrl: toUrl, verdict: review.verdict, notes: review.notes, jobId: review.jobId, reviewedBy: review.reviewedBy, reviewedAt: review.reviewedAt })));
  return reviews.length;
}
