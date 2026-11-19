import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { boardById, boardsWaiting, type BoardWithLead } from "../boards/store";
import { db } from "../db/client";
import { designerClaims, designers } from "../db/schema";

export type ClaimResult = "claimed" | "yours" | "taken" | "gone";

/**
 * A designer takes the business behind a waiting board. The claim is one row per business, so of two designers
 * claiming at once only the first gets it, and the business is theirs from then on.
 */
export async function claimBoard(boardId: string, designerId: string): Promise<{ result: ClaimResult; board: BoardWithLead | null }> {
  const board = await boardById(boardId);
  if (!board || board.chosenAt) return { result: "gone", board };
  const [row] = await (await db()).insert(designerClaims).values({ businessId: board.businessId, designerId }).onConflictDoNothing().returning();
  if (row) return { result: "claimed", board };
  return { result: (await ownerOf(board.businessId)) === designerId ? "yours" : "taken", board };
}

/** The ID of the designer a business belongs to, or null when none has claimed it. */
export async function ownerOf(businessId: string): Promise<string | null> {
  const [claim] = await (await db()).select({ designerId: designerClaims.designerId }).from(designerClaims).where(eq(designerClaims.businessId, businessId));
  return claim?.designerId ?? null;
}

export async function owns(designerId: string, businessId: string): Promise<boolean> {
  return (await ownerOf(businessId)) === designerId;
}

/** The businesses a designer has claimed, the newest claim first. */
export async function claimsOf(designerId: string) {
  return (await db()).select().from(designerClaims).where(eq(designerClaims.designerId, designerId));
}

/** For these businesses, the name of the designer each belongs to. */
export async function claimNames(businessIds: string[]): Promise<Map<string, string>> {
  if (!businessIds.length) return new Map();
  const rows = await (await db())
    .select({ businessId: designerClaims.businessId, name: designers.name })
    .from(designerClaims)
    .innerJoin(designers, eq(designers.id, designerClaims.designerId))
    .where(inArray(designerClaims.businessId, businessIds));
  return new Map(rows.map((row) => [row.businessId, row.name]));
}

/** Designs that wait for a choice on a business no designer has claimed, the one that has waited longest first. */
export async function pool(): Promise<BoardWithLead[]> {
  const waiting = await boardsWaiting();
  const claimed = await claimNames(waiting.map((board) => board.businessId));
  return waiting.filter((board) => !claimed.has(board.businessId));
}

/** Of these businesses, the ones this designer has claimed. */
export async function ownedAmong(designerId: string, businessIds: string[]): Promise<Set<string>> {
  if (!businessIds.length) return new Set();
  const rows = await (await db())
    .select({ businessId: designerClaims.businessId })
    .from(designerClaims)
    .where(and(eq(designerClaims.designerId, designerId), inArray(designerClaims.businessId, businessIds)));
  return new Set(rows.map((row) => row.businessId));
}
