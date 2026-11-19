import "server-only";
import { z } from "zod";
import { BOARD_LETTERS } from "@/lib/boards";
import { MAX_NOTE_TEXT } from "@/lib/review";
import { record } from "../activity";
import type { DesignBoard } from "../db/schema";
import { businessById } from "../leads/businesses";
import { requestPreview } from "../runner/jobs";
import { chooseBoard, noteBehindBoards, redrawBoards } from "./store";

const Id = z.string().uuid();
const Feedback = z.string().trim().max(MAX_NOTE_TEXT).default("");

const Choice = z.object({ id: Id, letter: z.enum(BOARD_LETTERS), feedback: Feedback });
const Revise = z.object({ id: Id, letter: z.enum(BOARD_LETTERS), feedback: z.string().trim().min(1).max(MAX_NOTE_TEXT) });
const Redraw = z.object({ id: Id, feedback: Feedback, selected: z.enum(BOARD_LETTERS).nullable() });

/** The decision a Designs form sends: build an option, revise one with words, or draw three new ones. */
export type BoardDecisionKind = "choose" | "revise" | "redraw";

export function boardIdIn(formData: FormData): string {
  return Id.parse(formData.get("id"));
}

/** Queues the job that acts on the decision, carrying any note the job that made the boards was given. */
async function queueFor(board: DesignBoard, by: string) {
  const lead = await businessById(board.businessId);
  if (lead) await requestPreview(lead, by, await noteBehindBoards(board));
}

const optionName = (board: DesignBoard, letter: string) => board.options.find((option) => option.letter === letter)?.name ?? "";

async function choose(formData: FormData, by: string) {
  const choice = Choice.parse({ id: formData.get("id"), letter: formData.get("letter"), feedback: formData.get("feedback") ?? "" });
  const board = await chooseBoard(choice.id, choice.letter, choice.feedback, by);
  if (!board) return;
  await queueFor(board, by);
  await record(by, "chose a design", { businessId: board.businessId, detail: `${choice.letter.toUpperCase()}: ${optionName(board, choice.letter)}${choice.feedback ? `. ${choice.feedback}` : ""}`.slice(0, 500) });
}

async function revise(formData: FormData, by: string) {
  const request = Revise.parse({ id: formData.get("id"), letter: formData.get("letter"), feedback: formData.get("feedback") ?? "" });
  const board = await redrawBoards(request.id, request.feedback, by, { base: request.letter });
  if (!board) return;
  await queueFor(board, by);
  await record(by, "asked for a design to be revised", { businessId: board.businessId, detail: `${request.letter.toUpperCase()}: ${optionName(board, request.letter)}. ${request.feedback}`.slice(0, 500) });
}

async function redraw(formData: FormData, by: string) {
  const request = Redraw.parse({ id: formData.get("id"), feedback: formData.get("feedback") ?? "", selected: formData.get("letter") || null });
  const board = await redrawBoards(request.id, request.feedback, by, { selected: request.selected });
  if (!board) return;
  await queueFor(board, by);
  await record(by, "asked for three new designs", { businessId: board.businessId, detail: request.feedback.slice(0, 500) });
}

const DECIDE: Record<BoardDecisionKind, (formData: FormData, by: string) => Promise<void>> = { choose, revise, redraw };

/**
 * Records a decision about a lead's three designs under the email of whoever made it, a founder or a designer. The
 * first decision stands (someone else may have the page open too), and each one queues the job that acts on it.
 */
export async function decideBoard(kind: BoardDecisionKind, formData: FormData, by: string): Promise<void> {
  await DECIDE[kind](formData, by);
}
