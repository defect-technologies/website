import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lt, ne, or } from "drizzle-orm";
import { BOARD_LETTERS, type BoardDecision, type BoardLetter, type BoardOption, type BoardPick, type BoardRedraw, isRedrawn, redrawnMark, REPLACED, revisedLetter, revisingMark, verdictOf } from "@/lib/boards";
import { founderName } from "@/lib/founders";
import { founderNote } from "@/lib/previewJobs";
import { db } from "../db/client";
import { businesses, designBoards, previewJobs, type DesignBoard } from "../db/schema";

/** How many decided boards the next draw and the next option writer learn from. */
const DECISIONS_KEPT = 200;

export type BoardWithLead = DesignBoard & { businessName: string; slug: string };

/** Saves the three options a job pictured. A job that reports again (the runner retried) replaces what it sent. */
export async function saveBoards(values: { businessId: string; jobId: string; options: BoardOption[]; pick: BoardPick | null }): Promise<DesignBoard> {
  const [board] = await (await db())
    .insert(designBoards)
    .values(values)
    .onConflictDoUpdate({ target: designBoards.jobId, set: { options: values.options, pick: values.pick } })
    .returning();
  return board;
}

const WITH_LEAD = { board: designBoards, businessName: businesses.businessName, slug: businesses.slug };

function withLead(row: { board: DesignBoard; businessName: string; slug: string }): BoardWithLead {
  return { ...row.board, businessName: row.businessName, slug: row.slug };
}

export async function boardById(id: string): Promise<BoardWithLead | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await (await db()).select(WITH_LEAD).from(designBoards).innerJoin(businesses, eq(businesses.id, designBoards.businessId)).where(eq(designBoards.id, id));
  return row ? withLead(row) : null;
}

/** Boards no founder has chosen from yet, the one that has waited longest first. */
export async function boardsWaiting(): Promise<BoardWithLead[]> {
  const rows = await (await db()).select(WITH_LEAD).from(designBoards).innerJoin(businesses, eq(businesses.id, designBoards.businessId)).where(isNull(designBoards.chosenAt)).orderBy(asc(designBoards.createdAt));
  return rows.map(withLead);
}

/** The newest boards for every business, decided or not: what the next composer is told not to repeat. */
export async function newestBoards(limit: number): Promise<BoardWithLead[]> {
  const rows = await (await db()).select(WITH_LEAD).from(designBoards).innerJoin(businesses, eq(businesses.id, designBoards.businessId)).orderBy(desc(designBoards.createdAt)).limit(limit);
  return rows.map(withLead);
}

export async function countBoardsWaiting(): Promise<number> {
  const [row] = await (await db()).select({ total: count() }).from(designBoards).where(isNull(designBoards.chosenAt));
  return row?.total ?? 0;
}

/** Boards a founder has chosen an option from, the newest choice first. A board they turned down is not one. */
export async function boardsDecided(limit = DECISIONS_KEPT): Promise<BoardWithLead[]> {
  const rows = await (await db())
    .select(WITH_LEAD)
    .from(designBoards)
    .innerJoin(businesses, eq(businesses.id, designBoards.businessId))
    .where(and(isNotNull(designBoards.chosenAt), inArray(designBoards.chosenLetter, [...BOARD_LETTERS])))
    .orderBy(desc(designBoards.chosenAt))
    .limit(limit);
  return rows.map(withLead);
}

function isLetter(value: string | null): value is BoardLetter {
  return (BOARD_LETTERS as readonly string[]).includes(value ?? "");
}

/**
 * Boards a founder has decided in any way (chosen, revised or turned down), the newest first. Boards Redraw all
 * replaced are left out: that judged the system, not the designs.
 */
async function boardsJudged(limit: number): Promise<BoardWithLead[]> {
  const rows = await (await db())
    .select(WITH_LEAD)
    .from(designBoards)
    .innerJoin(businesses, eq(businesses.id, designBoards.businessId))
    .where(and(isNotNull(designBoards.chosenAt), ne(designBoards.chosenLetter, REPLACED)))
    .orderBy(desc(designBoards.chosenAt))
    .limit(limit);
  return rows.map(withLead);
}

/** A decided board as the learning code reads it (src/lib/boards.ts), with the founder who decided it. */
export function decisionOf(board: BoardWithLead): BoardDecision | null {
  const decided = verdictOf(board.chosenLetter);
  if (!decided) return null;
  return { business: board.businessName, options: board.options, ...decided, feedback: board.feedback, by: founderName(board.chosenBy ?? ""), pick: board.pick ?? null };
}

/** Every founder's decisions, the newest first: what the next draw and option writer learn each founder's taste from. */
export async function decisions(limit = DECISIONS_KEPT): Promise<BoardDecision[]> {
  return (await boardsJudged(limit)).map(decisionOf).filter((decision): decision is BoardDecision => decision !== null);
}

/** Records a founder's choice. Null when the board is gone, has no such option or was already chosen from: the first choice stands. */
export async function chooseBoard(id: string, letter: BoardLetter, feedback: string, by: string): Promise<DesignBoard | null> {
  const board = await boardById(id);
  if (!board || !board.options.some((option) => option.letter === letter)) return null;
  const [chosen] = await (await db())
    .update(designBoards)
    .set({ chosenLetter: letter, feedback: feedback.trim(), chosenBy: by, chosenAt: new Date() })
    .where(and(eq(designBoards.id, id), isNull(designBoards.chosenAt)))
    .returning();
  return chosen ?? null;
}

/**
 * What a founder wrote in the note of the job that made these boards. The job that builds their choice carries it, so
 * the words are not lost when the build stops for the boards.
 */
export async function noteBehindBoards(board: Pick<DesignBoard, "jobId">): Promise<string> {
  const [job] = await (await db()).select({ note: previewJobs.note }).from(previewJobs).where(eq(previewJobs.id, board.jobId));
  return founderNote(job?.note ?? "");
}

/**
 * Records that a founder asked for the boards to be drawn again, with what they said: three revisions of the option
 * `base` names, or three new ones, noting the option they had `selected` while they wrote. Null when the board is gone,
 * has no such option or was already decided: the first decision stands.
 */
export async function redrawBoards(id: string, feedback: string, by: string, again: { base?: BoardLetter; selected?: BoardLetter | null } = {}): Promise<DesignBoard | null> {
  const board = await boardById(id);
  const named = again.base ?? again.selected;
  if (!board || (named && !board.options.some((option) => option.letter === named))) return null;
  const [turnedDown] = await (await db())
    .update(designBoards)
    .set({ chosenLetter: again.base ? revisingMark(again.base) : redrawnMark(again.selected ?? null), feedback: feedback.trim(), chosenBy: by, chosenAt: new Date() })
    .where(and(eq(designBoards.id, id), isNull(designBoards.chosenAt)))
    .returning();
  return turnedDown ?? null;
}

/**
 * Replaces every board that waits, so the runner draws each lead's designs again with the system it has now. No founder
 * judged these designs, so it records no words and teaches no taste. Returns the boards it replaced; one a founder
 * decided meanwhile is left alone.
 */
export async function redrawWaiting(by: string): Promise<DesignBoard[]> {
  return (await db())
    .update(designBoards)
    .set({ chosenLetter: REPLACED, feedback: "", chosenBy: by, chosenAt: new Date() })
    .where(isNull(designBoards.chosenAt))
    .returning();
}

/**
 * What the runner draws a lead's boards again from: set while the lead's newest board is one a founder turned down.
 * Once the new boards arrive they are the newest, and this is null again.
 */
export async function redrawFor(businessId: string): Promise<BoardRedraw | null> {
  const [newest] = await (await db()).select().from(designBoards).where(eq(designBoards.businessId, businessId)).orderBy(desc(designBoards.createdAt)).limit(1);
  if (!newest || !(isRedrawn(newest.chosenLetter) || revisedLetter(newest.chosenLetter))) return null;
  const decided = verdictOf(newest.chosenLetter);
  const letter = decided?.letter;
  const named = !letter ? {} : decided.verdict === "revise" ? { base: letter } : { selected: letter };
  const replaced = newest.chosenLetter === REPLACED ? { replaced: true as const } : {};
  return { feedback: newest.feedback, by: founderName(newest.chosenBy ?? ""), ...named, ...replaced, board: newest.id };
}

/** The board a lead had before this one, when a founder asked for these as revisions of one of its options. */
export async function revisionOf(board: Pick<DesignBoard, "businessId" | "createdAt">): Promise<{ option: BoardOption; feedback: string } | null> {
  const [earlier] = await (await db())
    .select()
    .from(designBoards)
    .where(and(eq(designBoards.businessId, board.businessId), lt(designBoards.createdAt, board.createdAt)))
    .orderBy(desc(designBoards.createdAt))
    .limit(1);
  const letter = revisedLetter(earlier?.chosenLetter ?? null);
  const option = letter ? earlier?.options.find((entry) => entry.letter === letter) : undefined;
  return option ? { option, feedback: earlier!.feedback } : null;
}

export type BoardChoice = { letter: BoardLetter; feedback: string; by: string };

/**
 * The choice a build job carries to the runner: the lead's newest decided board, when no other job has built from it.
 * The first job to claim it is the one that builds it, and it gets the same choice again if it is cut off and resumed.
 */
export async function choiceForJob(businessId: string, jobId: string): Promise<BoardChoice | null> {
  const [board] = await (await db())
    .select()
    .from(designBoards)
    .where(and(eq(designBoards.businessId, businessId), isNotNull(designBoards.chosenAt), or(isNull(designBoards.builtJobId), eq(designBoards.builtJobId, jobId))))
    .orderBy(desc(designBoards.chosenAt))
    .limit(1);
  if (!board || !isLetter(board.chosenLetter)) return null;
  if (!board.builtJobId) await (await db()).update(designBoards).set({ builtJobId: jobId }).where(eq(designBoards.id, board.id));
  return { letter: board.chosenLetter, feedback: board.feedback, by: founderName(board.chosenBy ?? "") };
}

/** The lead's newest boards, decided or not. */
export async function newestBoardFor(businessId: string): Promise<DesignBoard | null> {
  const [board] = await (await db()).select().from(designBoards).where(eq(designBoards.businessId, businessId)).orderBy(desc(designBoards.createdAt)).limit(1);
  return board ?? null;
}

/** Of these leads, the ones that have design boards: they get new designs, so their old preview needs no kit update. */
export async function withBoards(businessIds: string[]): Promise<Set<string>> {
  if (!businessIds.length) return new Set();
  const rows = await (await db()).selectDistinct({ id: designBoards.businessId }).from(designBoards).where(inArray(designBoards.businessId, businessIds));
  return new Set(rows.map((row) => row.id));
}

/** Whether the lead has boards that still wait for a founder: a build of it would be built without their choice. */
export async function waitingBoardFor(businessId: string): Promise<DesignBoard | null> {
  const [board] = await (await db()).select().from(designBoards).where(and(eq(designBoards.businessId, businessId), isNull(designBoards.chosenAt))).orderBy(desc(designBoards.createdAt)).limit(1);
  return board ?? null;
}
