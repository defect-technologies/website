import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
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
 * The board whose choice `jobId` built, or else the newest board whose build finished: the one the business's current
 * preview came from. A build still running or one that failed left the earlier preview in place.
 */
async function builtBoard(businessId: string, jobId?: string): Promise<DesignBoard | null> {
  const builtBy = jobId ? eq(designBoards.builtJobId, jobId) : isNotNull(designBoards.builtJobId);
  const [row] = await (await db())
    .select({ board: designBoards })
    .from(designBoards)
    .innerJoin(previewJobs, eq(previewJobs.id, designBoards.builtJobId))
    .where(and(eq(designBoards.businessId, businessId), builtBy, jobId ? undefined : eq(previewJobs.status, "done")))
    .orderBy(desc(designBoards.chosenAt))
    .limit(1);
  return row?.board ?? null;
}

/** The chosen design a business's preview was built from. Null for a preview built before boards recorded their build. */
export async function builtDesignFor(businessId: string, jobId?: string): Promise<BuiltDesign | null> {
  const board = await builtBoard(businessId, jobId);
  const option = board ? chosenOption(board) : null;
  if (!board || !option) return null;
  const by = (await deciders())(board.chosenBy ?? "").name;
  return { boardId: board.id, letter: option.letter, option, by, at: board.chosenAt, feedback: board.feedback };
}
