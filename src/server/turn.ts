import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { type Turn, TURN_PATH, turnsInOrder } from "@/lib/turn";
import { boardsWaiting } from "./boards/store";
import { db } from "./db/client";
import { businesses, previewJobs } from "./db/schema";
import { reviewQueue } from "./review/queue";

/** Of these leads, the ones whose present preview a repair made, with its before and after pictures. */
async function repairedAmong(leadIds: string[]): Promise<Set<string>> {
  if (!leadIds.length) return new Set();
  const rows = await (await db())
    .select({ id: businesses.id })
    .from(businesses)
    .innerJoin(previewJobs, and(eq(previewJobs.businessId, businesses.id), eq(previewJobs.previewUrl, businesses.previewUrl), eq(previewJobs.status, "done")))
    .where(and(inArray(businesses.id, leadIds), sql`jsonb_typeof(${previewJobs.result} -> 'repairs') = 'array'`));
  return new Set(rows.map((row) => row.id));
}

/** Everything that waits for a founder's taste, in the order to take it. */
export async function turns(): Promise<Turn[]> {
  const [previews, boards] = await Promise.all([reviewQueue(), boardsWaiting()]);
  const repaired = await repairedAmong(previews.map((lead) => lead.id));
  return turnsInOrder(previews.filter((lead) => repaired.has(lead.id)), boards, previews);
}

/** Where a founder goes after a decision: the next thing that waits, or the queue's own page when nothing does. */
export async function nextTurnHref(): Promise<string> {
  const [next] = await turns();
  return next?.href ?? TURN_PATH;
}
