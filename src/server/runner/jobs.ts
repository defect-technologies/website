import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { ACTIVE_JOB_STATUSES, type PreviewJobStatus } from "@/lib/previewJobs";
import { record } from "../activity";
import { db } from "../db/client";
import { previewJobs, type Business, type PreviewJob } from "../db/schema";
import { businessById, updateBusiness } from "../leads/businesses";

export type RequestResult = { job: PreviewJob; created: boolean };

/** Midnight in Los Angeles, as a timestamp, so the daily cap follows the founders' day. */
const LA_MIDNIGHT = sql`(date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles')`;

export async function activeJobFor(businessId: string): Promise<PreviewJob | null> {
  const [job] = await (await db())
    .select()
    .from(previewJobs)
    .where(and(eq(previewJobs.businessId, businessId), inArray(previewJobs.status, [...ACTIVE_JOB_STATUSES])));
  return job ?? null;
}

/** Queues a build for the lead, or returns the one already queued or running. */
export async function requestPreview(lead: Business, requestedBy: string, note = ""): Promise<RequestResult> {
  const existing = await activeJobFor(lead.id);
  if (existing) return { job: existing, created: false };
  const [job] = await (await db())
    .insert(previewJobs)
    .values({ businessId: lead.id, requestedBy, note })
    .onConflictDoNothing()
    .returning();
  if (!job) return { job: (await activeJobFor(lead.id))!, created: false };
  await updateBusiness(lead.id, { previewRequestedAt: new Date(), previewRequestedBy: requestedBy });
  await record(requestedBy, note ? "requested a preview rebuild" : "requested a preview", { businessId: lead.id, detail: note });
  return { job, created: true };
}

/** Builds started (or claimed) since midnight in Los Angeles. */
export async function buildsToday(): Promise<number> {
  const [row] = await (await db())
    .select({ count: sql<number>`count(*)::int` })
    .from(previewJobs)
    .where(gte(sql`coalesce(${previewJobs.startedAt}, ${previewJobs.claimedAt})`, LA_MIDNIGHT));
  return row?.count ?? 0;
}

/** What today's finished builds would have cost at API prices, in dollars. */
export async function spentToday(): Promise<number> {
  const [row] = await (await db())
    .select({ usd: sql<number>`coalesce(sum(${previewJobs.apiEquivalentUsd}), 0)::float` })
    .from(previewJobs)
    .where(and(eq(previewJobs.status, "done"), gte(previewJobs.finishedAt, LA_MIDNIGHT)));
  return row?.usd ?? 0;
}

/**
 * Claims the oldest queued job in one statement. SKIP LOCKED means two runners
 * polling at once can never both get the same job.
 */
export async function claimNextJob(runnerName: string): Promise<PreviewJob | null> {
  const oldestQueued = sql`(select ${previewJobs.id} from ${previewJobs} where ${previewJobs.status} = 'queued' order by ${previewJobs.createdAt} limit 1 for update skip locked)`;
  const [job] = await (await db())
    .update(previewJobs)
    .set({ status: "claimed", claimedAt: new Date(), runnerName, attempts: sql`${previewJobs.attempts} + 1` })
    .where(and(eq(previewJobs.id, oldestQueued), eq(previewJobs.status, "queued")))
    .returning();
  return job ?? null;
}

export async function jobById(id: string): Promise<PreviewJob | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [job] = await (await db()).select().from(previewJobs).where(eq(previewJobs.id, id));
  return job ?? null;
}

export async function updateJob(id: string, fields: Partial<PreviewJob>) {
  const [job] = await (await db()).update(previewJobs).set(fields).where(eq(previewJobs.id, id)).returning();
  return job;
}

export async function leadForJob(job: PreviewJob): Promise<Business> {
  const lead = await businessById(job.businessId);
  if (!lead) throw new Error(`Preview job ${job.id} points at a missing lead.`);
  return lead;
}

export function isActive(status: PreviewJobStatus): boolean {
  return (ACTIVE_JOB_STATUSES as readonly string[]).includes(status);
}
