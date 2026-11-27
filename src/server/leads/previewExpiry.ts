import "server-only";
import { and, asc, eq, inArray, isNotNull, ne, notExists, sql } from "drizzle-orm";
import { ACTIVE_JOB_STATUSES, PREVIEW_DAYS_KEPT } from "@/lib/previewJobs";
import type { Stage } from "@/lib/stages";
import { db } from "../db/client";
import { businesses, previewJobs, type Business } from "../db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many failed redeploys of one preview before the runner stops putting it back by itself. */
const REDEPLOY_TRIES = 2;

/**
 * When the lead's current preview link was deployed: the finished job that deployed it, or previewBuiltAt for a
 * preview reported some other way (the builder run by hand reports through /api/engine/previews, with no job).
 */
export const previewDeployedAt = sql<Date | null>`coalesce(
  (select max(deployed.finished_at) from preview_jobs deployed
    where deployed.business_id = ${businesses.id} and deployed.preview_url = ${businesses.previewUrl} and deployed.status = 'done'),
  ${businesses.previewBuiltAt})`;

const oldestKept = () => new Date(Date.now() - PREVIEW_DAYS_KEPT * DAY_MS).toISOString();

/** The preview deployment is older than the cleanup keeps one. */
export const previewIsOld = () => sql`(${businesses.previewUrl} <> '' and ${previewDeployedAt} < ${oldestKept()}::timestamptz)`;

/** An unpaid lead's preview the cleanup has deleted, or deletes today: no email may link to it, and nobody reviews it. */
export const previewExpired = () => sql`(${businesses.paidAt} is null and ${previewIsOld()})`;

/** Which of these leads (every lead, without ids) have an expired preview. */
export async function expiredPreviewIds(ids?: string[]): Promise<Set<string>> {
  if (ids && ids.length === 0) return new Set();
  const rows = await (await db())
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(previewExpired(), ids ? inArray(businesses.id, ids) : undefined));
  return new Set(rows.map((row) => row.id));
}

/** Leads whose preview someone may still open: an owner we may email or have emailed, or a client being set up. */
const PUT_BACK_STAGES: Stage[] = ["new", "preview_built", "sent", "clicked", "replied", "paid"];

/** A paying client first, then a preview nobody has emailed yet, then one waiting on a follow-up, then the rest. */
const putBackOrder = sql`case
  when ${businesses.paidAt} is not null then 0
  when ${businesses.stage} in ('new', 'preview_built') then 1
  when ${businesses.stage} in ('sent', 'clicked') then 2
  else 3 end`;

const failedRedeploysOfThisPreview = sql`(select count(*) from preview_jobs tried
  where tried.business_id = ${businesses.id} and tried.kind = 'redeploy' and tried.status = 'failed' and tried.created_at > ${previewDeployedAt})`;

/**
 * Old previews worth deploying again, the most urgent first. A launched site has its own project and needs none. A
 * lead with a job queued or running waits for it, and a preview whose redeploys keep failing is left for a founder.
 */
export async function oldPreviewsToPutBack(limit = 10): Promise<Business[]> {
  const database = await db();
  return database
    .select()
    .from(businesses)
    .where(
      and(
        previewIsOld(),
        eq(businesses.vercelProjectId, ""),
        inArray(businesses.stage, PUT_BACK_STAGES),
        sql`${failedRedeploysOfThisPreview} < ${REDEPLOY_TRIES}`,
        notExists(
          database
            .select({ one: sql`1` })
            .from(previewJobs)
            .where(and(eq(previewJobs.businessId, businesses.id), inArray(previewJobs.status, [...ACTIVE_JOB_STATUSES]))),
        ),
      ),
    )
    .orderBy(putBackOrder, asc(previewDeployedAt))
    .limit(limit);
}

/** Whether the preview still answers. A paid client's is kept by the cleanup, so it may be old and still up. */
export async function previewIsUp(previewUrl: string): Promise<boolean> {
  try {
    const response = await fetch(previewUrl, { method: "HEAD", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(10_000) });
    return response.status < 400;
  } catch {
    return true;
  }
}

/** The preview addresses the cleanup must keep however old: each paying client's current preview. */
export async function previewsToKeep(): Promise<string[]> {
  const rows = await (await db())
    .select({ previewUrl: businesses.previewUrl })
    .from(businesses)
    .where(and(isNotNull(businesses.paidAt), ne(businesses.previewUrl, "")));
  return rows.map((row) => row.previewUrl);
}
