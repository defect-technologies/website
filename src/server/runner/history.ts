import "server-only";
import { count, inArray } from "drizzle-orm";
import { FINISHED_JOB_STATUSES } from "@/lib/previewJobs";
import { db } from "../db/client";
import { previewJobs } from "../db/schema";
import { finishedJobs, type JobRow } from "./status";

export const BUILDS_PER_PAGE = 50;

export type BuildHistory = { jobs: JobRow[]; total: number; page: number; pages: number };

/** One page of every build that has ever finished, newest first. A page past the end shows the last one. */
export async function buildHistory(requestedPage: number): Promise<BuildHistory> {
  const [row] = await (await db()).select({ total: count() }).from(previewJobs).where(inArray(previewJobs.status, [...FINISHED_JOB_STATUSES]));
  const total = row?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / BUILDS_PER_PAGE));
  const page = Math.min(requestedPage, pages);
  const jobs = await finishedJobs(BUILDS_PER_PAGE, (page - 1) * BUILDS_PER_PAGE);
  return { jobs, total, page, pages };
}
