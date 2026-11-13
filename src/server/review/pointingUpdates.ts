import "server-only";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { ACTIVE_JOB_STATUSES } from "@/lib/previewJobs";
import { POINTING_NOTE } from "@/lib/review";
import { record } from "../activity";
import { db } from "../db/client";
import { previewJobs } from "../db/schema";
import { businessById } from "../leads/businesses";
import { requestPreview } from "../runner/jobs";
import type { ReviewItem } from "./queue";

/** site-kit #34 (kit 0.11.8, the review bridge with its question label) merged; the runner builds from site-kit main. */
const BRIDGE_KIT_MERGED_AT = new Date("2026-11-10T17:05:56Z");
const ACTOR = "admin";

/** When the runner started the build behind each preview, by business. A preview the runner didn't make has no entry. */
async function buildStartTimes(items: ReviewItem[]): Promise<Map<string, Date | null>> {
  if (!items.length) return new Map();
  const rows = await (await db())
    .select({ businessId: previewJobs.businessId, previewUrl: previewJobs.previewUrl, startedAt: previewJobs.startedAt })
    .from(previewJobs)
    .where(and(inArray(previewJobs.businessId, items.map((item) => item.id)), eq(previewJobs.status, "done")))
    .orderBy(desc(previewJobs.finishedAt));
  const previewUrlOf = new Map(items.map((item) => [item.id, item.previewUrl]));
  const startTimes = new Map<string, Date | null>();
  for (const row of rows) {
    if (row.previewUrl !== previewUrlOf.get(row.businessId) || startTimes.has(row.businessId)) continue;
    startTimes.set(row.businessId, row.startedAt);
  }
  return startTimes;
}

/**
 * Every preview waiting for review that the runner built before the review bridge gets the kit-only rebuild, so the
 * review page can take the founder to each question's element. A preview with a build already queued leaves the queue,
 * so this runs once per preview.
 */
export async function queuePointingUpdates(queue: ReviewItem[]): Promise<number> {
  let queued = 0;
  const startTimes = await buildStartTimes(queue);
  for (const item of queue) {
    const startedAt = startTimes.get(item.id);
    if (!startedAt || startedAt >= BRIDGE_KIT_MERGED_AT) continue;
    const lead = await businessById(item.id);
    if (lead && (await requestPreview(lead, ACTOR, POINTING_NOTE)).created) queued++;
  }
  if (queued) await record(ACTOR, "queued pointing updates", { detail: `${queued} ${queued === 1 ? "preview" : "previews"}` });
  return queued;
}

/** Kit-only rebuilds still queued or building, for the review page to say what's on its way. */
export async function pointingUpdatesUnderway(): Promise<number> {
  const [row] = await (await db())
    .select({ total: count() })
    .from(previewJobs)
    .where(and(eq(previewJobs.note, POINTING_NOTE), inArray(previewJobs.status, [...ACTIVE_JOB_STATUSES])));
  return row?.total ?? 0;
}
