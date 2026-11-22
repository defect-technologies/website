import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { type Turn, type TurnPaths, turnsInOrder, type WaitingDesign, type WaitingSite } from "@/lib/turn";
import { boardsWaiting, type BoardWithLead } from "./boards/store";
import { db } from "./db/client";
import { businesses, previewJobs } from "./db/schema";
import { type ReviewItem, reviewQueue } from "./review/queue";

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

const waitingSite = (item: ReviewItem): WaitingSite => ({ id: item.id, businessName: item.businessName, previewUrl: item.previewUrl, held: item.stage === "new", since: item.previewBuiltAt });

const waitingDesign = (board: BoardWithLead): WaitingDesign => ({
  id: board.id,
  businessName: board.businessName,
  firstScreens: board.options.map((option) => option.pictures.desktop),
  since: board.createdAt,
});

/**
 * How many other things wait on To do besides this lead's. The founders are emailed only when this is 0: once
 * something waits, they come to the list and find the rest, and a runner drawing designs every few minutes would
 * otherwise send an email for each.
 */
export async function waitingBesides(businessId: string): Promise<number> {
  const [sites, boards] = await Promise.all([reviewQueue(), boardsWaiting()]);
  return sites.filter((site) => site.id !== businessId).length + boards.filter((board) => board.businessId !== businessId).length;
}

/** Waiting previews and boards as turns, in the order to take them, opening where `paths` says. */
export async function turnsOf(previews: ReviewItem[], boards: BoardWithLead[], paths?: TurnPaths): Promise<Turn[]> {
  const repaired = await repairedAmong(previews.map((lead) => lead.id));
  const sites = previews.map(waitingSite);
  return turnsInOrder(sites.filter((site) => repaired.has(site.id)), boards.map(waitingDesign), sites, paths);
}

/** Everything that waits for a founder's taste, in the order to take it. */
export async function turns(): Promise<Turn[]> {
  const [previews, boards] = await Promise.all([reviewQueue(), boardsWaiting()]);
  return turnsOf(previews, boards);
}
