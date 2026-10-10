import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { ACTIVE_JOB_STATUSES, type JobKind, type PreviewJobStatus } from "@/lib/previewJobs";
import { record } from "../activity";
import { db } from "../db/client";
import { businesses, previewJobs, type Business, type PreviewJob } from "../db/schema";
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

const REQUEST_ACTION: Record<JobKind, (note: string) => string> = {
  preview: (note) => (note ? "requested a preview rebuild" : "requested a preview"),
  launch: () => "requested a launch",
};

/** Queues a build (or a launch) for the lead, or returns the job already queued or running. */
export async function requestPreview(lead: Business, requestedBy: string, note = "", kind: JobKind = "preview"): Promise<RequestResult> {
  const existing = await activeJobFor(lead.id);
  if (existing) return { job: existing, created: false };
  const [job] = await (await db())
    .insert(previewJobs)
    .values({ businessId: lead.id, requestedBy, note, kind })
    .onConflictDoNothing()
    .returning();
  if (!job) return { job: (await activeJobFor(lead.id))!, created: false };
  if (kind === "preview") await updateBusiness(lead.id, { previewRequestedAt: new Date(), previewRequestedBy: requestedBy });
  await record(requestedBy, REQUEST_ACTION[kind](note), { businessId: lead.id, detail: note });
  return { job, created: true };
}

/** Why the lead's site can't launch yet, or null when it can. */
export function launchBlocker(lead: Business): string | null {
  if (!lead.paidAt) return "This lead hasn't paid, so its site can't launch.";
  if (!lead.previewUrl) return "This lead has no built preview to launch yet.";
  return null;
}

/** The lead's most recent job of this kind, finished or not. */
export async function latestJob(businessId: string, kind: JobKind): Promise<PreviewJob | null> {
  const [job] = await (await db())
    .select()
    .from(previewJobs)
    .where(and(eq(previewJobs.businessId, businessId), eq(previewJobs.kind, kind)))
    .orderBy(desc(previewJobs.createdAt))
    .limit(1);
  return job ?? null;
}

/** Failed builds since the lead's last successful one. */
export async function failuresInARow(businessId: string): Promise<number> {
  const jobs = await (await db())
    .select({ status: previewJobs.status })
    .from(previewJobs)
    .where(and(eq(previewJobs.businessId, businessId), eq(previewJobs.kind, "preview"), inArray(previewJobs.status, ["done", "failed"])))
    .orderBy(desc(previewJobs.createdAt))
    .limit(10);
  const firstSuccess = jobs.findIndex((job) => job.status === "done");
  return firstSuccess === -1 ? jobs.length : firstSuccess;
}

export const AUTO_QUEUE_ACTOR = "auto-queue";

/** The new lead most worth a preview: never requested, has a website and an email, highest outdated score first. */
export async function nextLeadToBuild(): Promise<Business | null> {
  const [lead] = await (await db())
    .select()
    .from(businesses)
    .where(and(eq(businesses.stage, "new"), ne(businesses.website, ""), ne(businesses.email, ""), eq(businesses.previewUrl, ""), isNull(businesses.previewRequestedAt)))
    .orderBy(desc(businesses.outdatedScore), asc(businesses.createdAt))
    .limit(1);
  return lead ?? null;
}

/** Queues the next lead's preview, so an empty queue never leaves the runner idle. Returns whether one was queued. */
export async function autoQueueNext(): Promise<boolean> {
  const lead = await nextLeadToBuild();
  if (!lead) return false;
  return (await requestPreview(lead, AUTO_QUEUE_ACTOR)).created;
}

/** Builds started (or claimed) since midnight in Los Angeles. */
export async function buildsToday(): Promise<number> {
  const [row] = await (await db())
    .select({ count: sql<number>`count(*)::int` })
    .from(previewJobs)
    .where(and(eq(previewJobs.kind, "preview"), gte(sql`coalesce(${previewJobs.startedAt}, ${previewJobs.claimedAt})`, LA_MIDNIGHT)));
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
 * Claims the oldest queued job of a kind this runner can do, in one statement. SKIP LOCKED means two runners
 * polling at once can never both get the same job.
 */
export async function claimNextJob(runnerName: string, kinds: JobKind[] = ["preview"]): Promise<PreviewJob | null> {
  const kindList = sql.join(kinds.map((kind) => sql`${kind}`), sql`, `);
  const oldestQueued = sql`(select ${previewJobs.id} from ${previewJobs} where ${previewJobs.status} = 'queued' and ${previewJobs.kind} in (${kindList}) order by ${previewJobs.createdAt} limit 1 for update skip locked)`;
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
