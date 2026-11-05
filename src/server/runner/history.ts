import "server-only";
import { count, inArray, notInArray, sql } from "drizzle-orm";
import { BUILD_OUTCOMES, FINISHED_JOB_STATUSES, SKIPPED_STEP, type BuildOutcome } from "@/lib/previewJobs";
import { db } from "../db/client";
import { previewJobs } from "../db/schema";
import { finishedJobs, type JobRow } from "./status";

export const BUILDS_PER_PAGE = 50;

export type BuildHistory = {
  jobs: JobRow[];
  /** How many builds ended each way, whether or not that outcome is hidden. */
  counts: Record<BuildOutcome, number>;
  hidden: BuildOutcome[];
  /** How many builds the hidden outcomes leave showing. */
  shown: number;
  page: number;
  pages: number;
};

/** buildOutcome from lib/previewJobs, as SQL, so hiding an outcome happens in the query and pages stay full. */
const OUTCOME = sql<BuildOutcome>`case
  when ${previewJobs.status} = 'failed' and ${previewJobs.step} = ${SKIPPED_STEP} then 'skipped'
  when ${previewJobs.status} = 'failed' then 'failed'
  when ${previewJobs.status} = 'waiting_for_usage' then 'paused'
  when ${previewJobs.kind} = 'launch' then 'launched'
  else 'built' end`;

async function outcomeCounts(): Promise<Record<BuildOutcome, number>> {
  const rows = await (await db())
    .select({ outcome: OUTCOME, total: count() })
    .from(previewJobs)
    .where(inArray(previewJobs.status, [...FINISHED_JOB_STATUSES]))
    .groupBy(sql`1`);
  const totals = new Map(rows.map((row) => [row.outcome, row.total]));
  return Object.fromEntries(BUILD_OUTCOMES.map((outcome) => [outcome, totals.get(outcome) ?? 0])) as Record<BuildOutcome, number>;
}

/** One page of every build that has ever finished, newest first, without the hidden outcomes. A page past the end shows the last one. */
export async function buildHistory(requestedPage: number, hidden: BuildOutcome[] = []): Promise<BuildHistory> {
  const counts = await outcomeCounts();
  const shown = BUILD_OUTCOMES.reduce((total, outcome) => (hidden.includes(outcome) ? total : total + counts[outcome]), 0);
  const pages = Math.max(1, Math.ceil(shown / BUILDS_PER_PAGE));
  const page = Math.min(requestedPage, pages);
  const jobs = await finishedJobs(BUILDS_PER_PAGE, (page - 1) * BUILDS_PER_PAGE, hidden.length > 0 ? notInArray(OUTCOME, hidden) : undefined);
  return { jobs, counts, hidden, shown, page, pages };
}
