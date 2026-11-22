import "server-only";
import { and, desc, eq, exists, gt, inArray } from "drizzle-orm";
import { BOARD_LETTERS, type BoardLetter, type BoardOption } from "@/lib/boards";
import { db } from "../db/client";
import { designBoards, previewJobs, type DesignBoard } from "../db/schema";
import { deciders } from "../designers/people";

/** The option a built preview was made from, who chose it, when, and what they asked to change. */
export type BuiltDesign = { boardId: string; letter: BoardLetter; option: BoardOption; by: string; at: Date | null; feedback: string };

function chosenOption(board: DesignBoard): BoardOption | null {
  if (!(BOARD_LETTERS as readonly string[]).includes(board.chosenLetter ?? "")) return null;
  return board.options.find((option) => option.letter === board.chosenLetter) ?? null;
}

/**
 * The newest chosen board that a build finished after: the one the business's current preview came from. The job that
 * took the choice may have failed and been retried by another, and a repair is another job too, so any build of the
 * business finished after the choice counts. A later choice still building leaves the earlier preview up.
 */
async function builtBoard(businessId: string): Promise<DesignBoard | null> {
  const finishedBuild = (await db())
    .select({ id: previewJobs.id })
    .from(previewJobs)
    .where(and(eq(previewJobs.businessId, businessId), eq(previewJobs.status, "done"), gt(previewJobs.createdAt, designBoards.chosenAt)));
  const [board] = await (await db())
    .select()
    .from(designBoards)
    .where(and(eq(designBoards.businessId, businessId), inArray(designBoards.chosenLetter, [...BOARD_LETTERS]), exists(finishedBuild)))
    .orderBy(desc(designBoards.chosenAt))
    .limit(1);
  return board ?? null;
}

/** The chosen design a business's preview was built from. Null when no build finished after a choice. */
export async function builtDesignFor(businessId: string): Promise<BuiltDesign | null> {
  const board = await builtBoard(businessId);
  const option = board ? chosenOption(board) : null;
  if (!board || !option) return null;
  const by = (await deciders())(board.chosenBy ?? "").name;
  return { boardId: board.id, letter: option.letter, option, by, at: board.chosenAt, feedback: board.feedback };
}
