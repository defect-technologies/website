import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, ne, notInArray, sql } from "drizzle-orm";
import { REDRAWN, REDRAWN_PREFIX, REPLACED, REVISE_PREFIX } from "@/lib/boards";
import { ACTIVE_JOB_STATUSES, BOARDS_STEP, isKitUpdate, type JobKind, type PreviewJobStatus, SKIPPED_STEP } from "@/lib/previewJobs";
import { POINTING_NOTE } from "@/lib/review";
import { record } from "../activity";
import { db } from "../db/client";
import { businesses, designBoards, previewJobs, type Business, type PreviewJob } from "../db/schema";
import { businessById, updateBusiness } from "../leads/businesses";
import { PACIFIC_MIDNIGHT as LA_MIDNIGHT } from "../outreach/pacificDay";

export type RequestResult = { job: PreviewJob; created: boolean };

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
  redeploy: () => "asked for an expired preview to be put back up",
};

/**
 * A request takes over a kit-only update still queued for the lead: the update was filling a runner with nothing
 * better to do, and a founder's choice or note is better. Before this, Boris's revision of a design sat behind the
 * update and lost its place in the queue.
 */
async function takeOver(existing: PreviewJob, requestedBy: string, note: string): Promise<RequestResult> {
  const [job] = await (await db())
    .update(previewJobs)
    .set({ requestedBy, note })
    .where(and(eq(previewJobs.id, existing.id), eq(previewJobs.status, "queued")))
    .returning();
  if (!job) return { job: existing, created: false };
  await record(requestedBy, REQUEST_ACTION[job.kind as JobKind](note), { businessId: job.businessId, detail: note });
  return { job, created: true };
}

/** Queues a build (or a launch) for the lead, or returns the job already queued or running. */
export async function requestPreview(lead: Business, requestedBy: string, note = "", kind: JobKind = "preview"): Promise<RequestResult> {
  const existing = await activeJobFor(lead.id);
  if (existing?.status === "queued" && kind === "preview" && isKitUpdate(existing.note) && !isKitUpdate(note)) return takeOver(existing, requestedBy, note);
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
    // A skipped build isn't a failure: the runner chose not to build. A job that only made boards isn't a success either.
    .where(and(eq(previewJobs.businessId, businessId), eq(previewJobs.kind, "preview"), inArray(previewJobs.status, ["done", "failed"]), notInArray(previewJobs.step, [SKIPPED_STEP, BOARDS_STEP])))
    .orderBy(desc(previewJobs.createdAt))
    .limit(10);
  const firstSuccess = jobs.findIndex((job) => job.status === "done");
  return firstSuccess === -1 ? jobs.length : firstSuccess;
}

export const AUTO_QUEUE_ACTOR = "auto-queue";

/** The new lead most worth a preview: never requested, has a website and an email, highest outdated score first. */
/** How many leads are waiting for the runner to queue them by itself (the same leads nextLeadToBuild picks from). */
export async function leadsWaitingToBuild(): Promise<number> {
  const [row] = await (await db())
    .select({ count: sql<number>`count(*)::int` })
    .from(businesses)
    .where(and(eq(businesses.stage, "new"), ne(businesses.website, ""), ne(businesses.email, ""), eq(businesses.previewUrl, ""), isNull(businesses.previewRequestedAt)));
  return row?.count ?? 0;
}

export async function nextLeadToBuild(): Promise<Business | null> {
  const [lead] = await (await db())
    .select()
    .from(businesses)
    .where(and(eq(businesses.stage, "new"), ne(businesses.website, ""), ne(businesses.email, ""), eq(businesses.previewUrl, ""), isNull(businesses.previewRequestedAt)))
    .orderBy(desc(businesses.outdatedScore), asc(businesses.createdAt))
    .limit(1);
  return lead ?? null;
}

/** Queues the next lead's preview, so an empty queue never leaves the runner idle. Returns the job it queued. */
export async function autoQueueNext(): Promise<PreviewJob | null> {
  const lead = await nextLeadToBuild();
  if (!lead) return null;
  const request = await requestPreview(lead, AUTO_QUEUE_ACTOR);
  return request.created ? request.job : null;
}

/**
 * New sites started (or claimed) since midnight in Los Angeles: first builds, redesigns and their retries. The cap they
 * count against keeps the runner from spending Claude's usage on new sites around the clock.
 */
export async function buildsToday(): Promise<number> {
  const [row] = await (await db())
    .select({ count: sql<number>`count(*)::int` })
    .from(previewJobs)
    // A skip takes a minute and builds nothing, so it doesn't use up a build. Neither does a job that only made boards,
    // nor a repair of a built site, which makes the notes' changes and builds nothing new.
    .where(and(eq(previewJobs.kind, "preview"), eq(previewJobs.repair, false), notInArray(previewJobs.step, [SKIPPED_STEP, BOARDS_STEP]), gte(sql`coalesce(${previewJobs.startedAt}, ${previewJobs.claimedAt})`, LA_MIDNIGHT)));
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

const claimedBy = (runnerName: string) => ({ status: "claimed" as const, claimedAt: new Date(), runnerName, attempts: sql`${previewJobs.attempts} + 1` });

/**
 * Which queued jobs a claim takes. "asked" is work someone is waiting on: a choice to build, a note, a retry, a
 * launch. "redraw" is new designs a founder asked for, three new ones or revisions of one, which build nothing.
 * "backfill" is the kit-only update of an old preview, which only fills a runner that has nothing better to do.
 * A founder's decision about the lead's newest board makes even a job queued as an update theirs.
 */
export type QueuedWork = "asked" | "redraw" | "backfill";

/** The lead's newest board was decided this way, and nothing has acted on it yet. */
const newestBoardDecided = (decision: ReturnType<typeof sql>) =>
  sql`exists (select 1 from ${designBoards} decided where decided.business_id = ${previewJobs.businessId} and decided.chosen_at is not null and ${decision}
    and not exists (select 1 from ${designBoards} newer where newer.business_id = decided.business_id and newer.created_at > decided.created_at))`;

const choiceWaits = newestBoardDecided(sql`decided.chosen_letter in ('a', 'b', 'c') and decided.built_job_id is null`);
/** Every way a board is drawn again (src/lib/boards.ts): three new, with or without a selected option, Redraw all, or a revision. */
const redrawWaits = newestBoardDecided(
  sql`(decided.chosen_letter in (${REDRAWN}, ${REPLACED}) or starts_with(decided.chosen_letter, ${REDRAWN_PREFIX}) or starts_with(decided.chosen_letter, ${REVISE_PREFIX}))`,
);

function queuedWorkIs(work: QueuedWork) {
  const kitUpdate = sql`starts_with(${previewJobs.note}, ${POINTING_NOTE})`;
  if (work === "redraw") return redrawWaits;
  if (work === "backfill") return sql`${kitUpdate} and not ${choiceWaits} and not ${redrawWaits}`;
  return sql`(not ${kitUpdate} or ${choiceWaits}) and not ${redrawWaits}`;
}

/**
 * Claims the oldest queued job of a kind this runner can do, in one statement. SKIP LOCKED means two runners
 * polling at once can never both get the same job.
 */
export async function claimNextJob(runnerName: string, kinds: JobKind[] = ["preview"], work: QueuedWork = "asked"): Promise<PreviewJob | null> {
  const kindList = sql.join(kinds.map((kind) => sql`${kind}`), sql`, `);
  const oldestQueued = sql`(select ${previewJobs.id} from ${previewJobs} where ${previewJobs.status} = 'queued' and ${previewJobs.kind} in (${kindList}) and ${queuedWorkIs(work)} order by ${previewJobs.createdAt} limit 1 for update skip locked)`;
  const [job] = await (await db())
    .update(previewJobs)
    .set(claimedBy(runnerName))
    .where(and(eq(previewJobs.id, oldestQueued), eq(previewJobs.status, "queued")))
    .returning();
  return job ?? null;
}

/** Queued preview jobs, the oldest first: the ones a runner past its daily cap looks through for repairs. */
export async function queuedPreviewJobs(limit = 50): Promise<PreviewJob[]> {
  return (await db())
    .select()
    .from(previewJobs)
    .where(and(eq(previewJobs.status, "queued"), eq(previewJobs.kind, "preview")))
    .orderBy(asc(previewJobs.createdAt))
    .limit(limit);
}

/** Claims this one queued job, unless another runner got to it first. */
export async function claimJob(runnerName: string, jobId: string): Promise<PreviewJob | null> {
  const [job] = await (await db())
    .update(previewJobs)
    .set(claimedBy(runnerName))
    .where(and(eq(previewJobs.id, jobId), eq(previewJobs.status, "queued")))
    .returning();
  return job ?? null;
}

/**
 * A runner builds one job at a time, so when it asks for the next one, any job still claimed or running under its
 * name was cut off (the runner was killed before it could report) and goes back in the queue. Its next claim is a
 * later attempt, which resumes it. Talin Market's build sat "running" for a day after one (13 October).
 */
export async function requeueOrphans(runnerName: string): Promise<PreviewJob[]> {
  return (await db())
    .update(previewJobs)
    .set({ status: "queued", step: "", claimedAt: null, startedAt: null })
    .where(and(eq(previewJobs.runnerName, runnerName), inArray(previewJobs.status, ["claimed", "running"])))
    .returning();
}

export async function jobById(id: string): Promise<PreviewJob | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [job] = await (await db()).select().from(previewJobs).where(eq(previewJobs.id, id));
  return job ?? null;
}

/**
 * Moves a queued job to the front of its queue: the runner takes the oldest queued job of a kind first, so it is
 * dated just before the oldest one. Putting a job back (settleAbandonedJobAction) dates it now, to the back. False
 * when the job isn't queued any more.
 */
export async function runNext(id: string): Promise<boolean> {
  const [oldest] = await (await db()).select({ at: previewJobs.createdAt }).from(previewJobs).where(eq(previewJobs.status, "queued")).orderBy(asc(previewJobs.createdAt)).limit(1);
  if (!oldest) return false;
  const moved = await (await db())
    .update(previewJobs)
    .set({ createdAt: new Date(oldest.at.getTime() - 1000) })
    .where(and(eq(previewJobs.id, id), eq(previewJobs.status, "queued")))
    .returning({ id: previewJobs.id });
  return moved.length > 0;
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
