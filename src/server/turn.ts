import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { type Turn, turnsInOrder, type WaitingDesign, type WaitingSite } from "@/lib/turn";
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

/** Everything that waits for a founder's taste, in the order to take it. */
export async function turns(): Promise<Turn[]> {
  const [previews, boards] = await Promise.all([reviewQueue(), boardsWaiting()]);
  const repaired = await repairedAmong(previews.map((lead) => lead.id));
  const sites = previews.map(waitingSite);
  return turnsInOrder(sites.filter((site) => repaired.has(site.id)), boards.map(waitingDesign), sites);
}
