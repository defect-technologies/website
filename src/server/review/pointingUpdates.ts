import "server-only";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { ACTIVE_JOB_STATUSES } from "@/lib/previewJobs";
import { POINTING_NOTE } from "@/lib/review";
import { record } from "../activity";
import { db } from "../db/client";
import { previewJobs } from "../db/schema";
import { businessById } from "../leads/businesses";
import { requestPreview } from "../runner/jobs";
import { reviewQueue } from "./queue";

/** site-kit #34 (kit 0.11.8, the review bridge with its question label) merged; the runner builds from site-kit main. */
const BRIDGE_KIT_MERGED_AT = new Date("2026-11-10T17:05:56Z");
const ACTOR = "admin";

/** The build that made this preview, or null when the runner didn't make it (a preview deployed by hand). */
async function buildOf(businessId: string, previewUrl: string) {
  const [job] = await (await db())
    .select({ startedAt: previewJobs.startedAt })
    .from(previewJobs)
    .where(and(eq(previewJobs.businessId, businessId), eq(previewJobs.previewUrl, previewUrl), eq(previewJobs.status, "done")))
    .orderBy(desc(previewJobs.finishedAt))
    .limit(1);
  return job ?? null;
}

/**
 * Every preview waiting for review that the runner built before the review bridge gets the kit-only rebuild, so the
 * review page can take the founder to each question's element. A preview with a build already queued leaves the queue,
 * so this runs once per preview.
 */
export async function queuePointingUpdates(): Promise<number> {
  let queued = 0;
  for (const item of await reviewQueue()) {
    const build = await buildOf(item.id, item.previewUrl);
    if (!build?.startedAt || build.startedAt >= BRIDGE_KIT_MERGED_AT) continue;
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
