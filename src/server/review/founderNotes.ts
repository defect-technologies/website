import "server-only";
import { and, desc, eq, isNotNull, ne, notInArray } from "drizzle-orm";
import { UNJUDGED, verdictOf } from "@/lib/boards";
import type { ReviewNote } from "@/lib/review";
import { db } from "../db/client";
import { businesses, designBoards, previewReviews, spotChecks } from "../db/schema";

/** How many of a founder's newest notes of each kind the Taste page reads. */
const NOTES_READ = 200;

/** Something a founder wrote while judging a design or a preview, kept with what they were judging. */
export type FounderNote = { id: string; text: string; at: Date; business: string; about: string; href: string };

const UPPER = (letter: string | null) => (letter ?? "").toUpperCase();

function boardAbout(chosenLetter: string | null): string {
  const decided = verdictOf(chosenLetter);
  if (decided?.verdict === "chose") return `Built ${UPPER(decided.letter)}`;
  if (decided?.verdict === "revise") return `Asked for ${UPPER(decided.letter)} revised`;
  return decided?.letter ? `Wanted none, with ${UPPER(decided.letter)} selected` : "Wanted none of the three";
}

async function boardNotes(email: string): Promise<FounderNote[]> {
  const rows = await (await db())
    .select({ id: designBoards.id, text: designBoards.feedback, at: designBoards.chosenAt, chosenLetter: designBoards.chosenLetter, business: businesses.businessName })
    .from(designBoards)
    .innerJoin(businesses, eq(businesses.id, designBoards.businessId))
    .where(and(eq(designBoards.chosenBy, email), isNotNull(designBoards.chosenAt), notInArray(designBoards.chosenLetter, UNJUDGED), ne(designBoards.feedback, "")))
    .orderBy(desc(designBoards.chosenAt))
    .limit(NOTES_READ);
  return rows.map((row) => ({ id: `board:${row.id}`, text: row.text, at: row.at ?? new Date(0), business: row.business, about: boardAbout(row.chosenLetter), href: `/admin/designs/${row.id}` }));
}

async function reviewNotes(email: string): Promise<FounderNote[]> {
  const rows = await (await db())
    .select({ id: previewReviews.id, notes: previewReviews.notes, at: previewReviews.reviewedAt, business: businesses.businessName, businessId: businesses.id })
    .from(previewReviews)
    .innerJoin(businesses, eq(businesses.id, previewReviews.businessId))
    .where(eq(previewReviews.reviewedBy, email))
    .orderBy(desc(previewReviews.reviewedAt))
    .limit(NOTES_READ);
  return rows.flatMap((row) =>
    row.notes.map((note: ReviewNote) => ({ id: `review:${row.id}:${note.id}`, text: note.text, at: row.at, business: row.business, about: "Preview sent back", href: `/admin/sites/${row.businessId}` })),
  );
}

async function spotCheckNotes(email: string): Promise<FounderNote[]> {
  const rows = await (await db())
    .select({ id: spotChecks.id, text: spotChecks.note, at: spotChecks.reviewedAt, business: businesses.businessName })
    .from(spotChecks)
    .innerJoin(businesses, eq(businesses.id, spotChecks.businessId))
    .where(and(eq(spotChecks.reviewedBy, email), ne(spotChecks.note, "")))
    .orderBy(desc(spotChecks.reviewedAt))
    .limit(NOTES_READ);
  return rows.map((row) => ({ id: `spot:${row.id}`, text: row.text, at: row.at ?? new Date(0), business: row.business, about: "Spot check", href: "/admin/spot-checks" }));
}

/**
 * Every note one founder has written about designs and previews, the newest first: their choices and turn-downs on
 * Designs, their review notes and their spot checks. Each founder's are kept apart so their taste can be read on its own.
 */
export async function notesBy(email: string): Promise<FounderNote[]> {
  const all = (await Promise.all([boardNotes(email), reviewNotes(email), spotCheckNotes(email)])).flat();
  return all.sort((a, b) => b.at.getTime() - a.at.getTime());
}
