import "server-only";
import { and, desc, eq, isNotNull, notInArray } from "drizzle-orm";
import { type BoardVerdict, UNJUDGED, verdictOf } from "@/lib/boards";
import type { ReviewNote, ReviewVerdict } from "@/lib/review";
import { db } from "../db/client";
import { businesses, designBoards, previewReviews } from "../db/schema";

const SHOWN = 100;

export type DesignDecision = { id: string; businessId: string; businessName: string; verdict: BoardVerdict; letter: string | null; optionName: string; feedback: string; at: Date };

export type BuildVerdict = { id: string; businessId: string; businessName: string; verdict: ReviewVerdict; notes: ReviewNote[]; previewUrl: string; at: Date };

/** Every design decision this person made, with their words, the newest first. */
export async function designDecisionsBy(email: string): Promise<DesignDecision[]> {
  const rows = await (await db())
    .select({ board: designBoards, businessName: businesses.businessName })
    .from(designBoards)
    .innerJoin(businesses, eq(businesses.id, designBoards.businessId))
    .where(and(eq(designBoards.chosenBy, email), isNotNull(designBoards.chosenAt), notInArray(designBoards.chosenLetter, UNJUDGED)))
    .orderBy(desc(designBoards.chosenAt))
    .limit(SHOWN);
  return rows.flatMap(({ board, businessName }) => {
    const decided = verdictOf(board.chosenLetter);
    if (!decided) return [];
    const optionName = board.options.find((option) => option.letter === decided.letter)?.name ?? "";
    return [{ id: board.id, businessId: board.businessId, businessName, verdict: decided.verdict, letter: decided.letter, optionName, feedback: board.feedback, at: board.chosenAt ?? board.createdAt }];
  });
}

/** Every built preview this person approved or sent back with notes, the newest first. */
export async function buildVerdictsBy(email: string): Promise<BuildVerdict[]> {
  const rows = await (await db())
    .select({ review: previewReviews, businessName: businesses.businessName })
    .from(previewReviews)
    .innerJoin(businesses, eq(businesses.id, previewReviews.businessId))
    .where(eq(previewReviews.reviewedBy, email))
    .orderBy(desc(previewReviews.reviewedAt))
    .limit(SHOWN);
  return rows.map(({ review, businessName }) => ({ id: review.id, businessId: review.businessId, businessName, verdict: review.verdict, notes: review.notes, previewUrl: review.previewUrl, at: review.reviewedAt }));
}
