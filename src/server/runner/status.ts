import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, max, sql, type SQL } from "drizzle-orm";
import { cache } from "react";
import { DEFAULT_BUILD_MINUTES, etaFor, median, queueStarts, splitActive, type Eta } from "@/lib/buildStatus";
import { FINISHED_JOB_STATUSES } from "@/lib/previewJobs";
import { db } from "../db/client";
import { businesses, previewJobs, type PreviewJob } from "../db/schema";

export type JobRow = PreviewJob & { businessName: string };
export type CurrentBuild = JobRow & { eta: Eta };
export type QueuedBuild = JobRow & { startsAt: Date };

const withName = { job: previewJobs, businessName: businesses.businessName };
const flatten = (rows: { job: PreviewJob; businessName: string }[]): JobRow[] => rows.map(({ job, businessName }) => ({ ...job, businessName }));

async function queuedOrActiveJobs(statuses: readonly PreviewJob["status"][]): Promise<JobRow[]> {
  const rows = await (await db())
    .select(withName)
    .from(previewJobs)
    .innerJoin(businesses, eq(previewJobs.businessId, businesses.id))
    .where(inArray(previewJobs.status, [...statuses]))
    .orderBy(asc(previewJobs.createdAt))
    .limit(200);
  return flatten(rows);
}

/** Finished builds, newest first. The tie-breaks keep a row on one page while pages are turned. */
export async function finishedJobs(limit: number, offset = 0, matching?: SQL): Promise<JobRow[]> {
  const rows = await (await db())
    .select(withName)
    .from(previewJobs)
    .innerJoin(businesses, eq(previewJobs.businessId, businesses.id))
    .where(and(inArray(previewJobs.status, [...FINISHED_JOB_STATUSES]), matching))
    .orderBy(sql`${previewJobs.finishedAt} desc nulls last`, desc(previewJobs.createdAt), asc(previewJobs.id))
    .limit(limit)
    .offset(offset);
  return flatten(rows);
}

/** The usual length of a preview build, from the last 20 that finished and reported one. */
async function usualMinutes(): Promise<number> {
  const rows = await (await db())
    .select({ minutes: previewJobs.minutes })
    .from(previewJobs)
    .where(and(eq(previewJobs.status, "done"), eq(previewJobs.kind, "preview"), isNotNull(previewJobs.minutes)))
    .orderBy(desc(previewJobs.finishedAt))
    .limit(20);
  return Math.round(median(rows.map((row) => row.minutes ?? 0).filter((value) => value > 0)) ?? DEFAULT_BUILD_MINUTES);
}

/** When each runner last finished a job. A runner that finished one after claiming another has abandoned the other. */
async function lastFinishedByRunner(): Promise<Map<string, Date>> {
  const rows = await (await db())
    .select({ runnerName: previewJobs.runnerName, at: max(previewJobs.finishedAt) })
    .from(previewJobs)
    .where(isNotNull(previewJobs.finishedAt))
    .groupBy(previewJobs.runnerName);
  return new Map(rows.filter((row) => row.at).map((row) => [row.runnerName, row.at as Date]));
}

/** What the preview runner is doing: the build in progress, the queue with start estimates, abandoned jobs and its last result. */
async function readStatus() {
  const [active, queued, [lastFinished], minutes, finished] = await Promise.all([
    queuedOrActiveJobs(["claimed", "running"]),
    queuedOrActiveJobs(["queued"]),
    finishedJobs(1),
    usualMinutes(),
    lastFinishedByRunner(),
  ]);
  const now = Date.now();
  const { current, abandoned } = splitActive(active, finished);
  const building: CurrentBuild[] = current.map((job) => ({ ...job, eta: etaFor(job, minutes, now) }));
  const lastDone = building.reduce<Date | null>((latest, job) => (!latest || job.eta.doneAt > latest ? job.eta.doneAt : latest), null);
  const starts = queueStarts(queued.length, lastDone, minutes, now);
  return {
    current: building,
    queue: queued.map((job, index): QueuedBuild => ({ ...job, startsAt: starts[index] })),
    abandoned,
    lastFinished,
    minutes,
    now,
  };
}

/** Read once per request: the layout's Builds dot, Today and the Builds page all use it. */
export const runnerStatus = cache(readStatus);

export type RunnerStatus = Awaited<ReturnType<typeof runnerStatus>>;

/** The active build for one lead with its ETA, or null, for the site page. */
export function buildFor(status: RunnerStatus, businessId: string): { kind: "current"; job: CurrentBuild } | { kind: "queued"; job: QueuedBuild; position: number } | { kind: "abandoned"; job: JobRow } | null {
  const current = status.current.find((job) => job.businessId === businessId);
  if (current) return { kind: "current", job: current };
  const position = status.queue.findIndex((job) => job.businessId === businessId);
  if (position >= 0) return { kind: "queued", job: status.queue[position], position: position + 1 };
  const abandoned = status.abandoned.find((job) => job.businessId === businessId);
  return abandoned ? { kind: "abandoned", job: abandoned } : null;
}
