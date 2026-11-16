"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BOARD_LETTERS } from "@/lib/boards";
import { MAX_NOTE_TEXT } from "@/lib/review";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { chooseBoard, noteBehindBoards, redrawBoards, redrawWaiting } from "@/server/boards/store";
import { businessById } from "@/server/leads/businesses";
import { requestPreview } from "@/server/runner/jobs";
import { TURN_PATH } from "@/lib/turn";

const Choice = z.object({
  id: z.string().uuid(),
  letter: z.enum(BOARD_LETTERS),
  feedback: z.string().trim().max(MAX_NOTE_TEXT).default(""),
});

/**
 * A founder chose one of a lead's three designs. The first choice stands (the other founder may have the page open
 * too). It queues the job that builds the site from that design, and the founder's words go with it, with any note the
 * job that made the boards was given. Every note is kept with the founder who wrote it.
 */
export async function chooseBoardAction(formData: FormData) {
  const founder = await requireFounder();
  const choice = Choice.parse({ id: formData.get("id"), letter: formData.get("letter"), feedback: formData.get("feedback") ?? "" });
  const board = await chooseBoard(choice.id, choice.letter, choice.feedback, founder.email);
  if (board) {
    const lead = await businessById(board.businessId);
    if (lead) await requestPreview(lead, founder.email, await noteBehindBoards(board));
    const name = board.options.find((option) => option.letter === choice.letter)?.name ?? "";
    await record(founder.email, "chose a design", { businessId: board.businessId, detail: `${choice.letter.toUpperCase()}: ${name}${choice.feedback ? `. ${choice.feedback}` : ""}`.slice(0, 500) });
  }
  revalidatePath("/admin", "layout");
  redirect(TURN_PATH);
}

const Redraw = z.object({ id: z.string().uuid(), feedback: z.string().trim().max(MAX_NOTE_TEXT).default(""), selected: z.enum(BOARD_LETTERS).nullable() });

const Revise = z.object({ id: z.string().uuid(), letter: z.enum(BOARD_LETTERS), feedback: z.string().trim().min(1).max(MAX_NOTE_TEXT) });

/**
 * A founder liked one of a lead's designs and wants it revised with their words before anything is built. The first
 * decision stands. It queues the job that draws three revisions of that option, which carries their words and any note
 * the job that made the boards was given.
 */
export async function reviseBoardAction(formData: FormData) {
  const founder = await requireFounder();
  const request = Revise.parse({ id: formData.get("id"), letter: formData.get("letter"), feedback: formData.get("feedback") ?? "" });
  const board = await redrawBoards(request.id, request.feedback, founder.email, { base: request.letter });
  if (board) {
    const lead = await businessById(board.businessId);
    if (lead) await requestPreview(lead, founder.email, await noteBehindBoards(board));
    const name = board.options.find((option) => option.letter === request.letter)?.name ?? "";
    await record(founder.email, "asked for a design to be revised", { businessId: board.businessId, detail: `${request.letter.toUpperCase()}: ${name}. ${request.feedback}`.slice(0, 500) });
  }
  revalidatePath("/admin", "layout");
  redirect(TURN_PATH);
}

/**
 * A founder wants none of a lead's three designs. The first decision stands. It queues the job that draws three new
 * ones, which carries what the founder said about these, the option they had selected while writing, and any note the
 * job that made them was given.
 */
export async function redrawBoardsAction(formData: FormData) {
  const founder = await requireFounder();
  const request = Redraw.parse({ id: formData.get("id"), feedback: formData.get("feedback") ?? "", selected: formData.get("letter") || null });
  const board = await redrawBoards(request.id, request.feedback, founder.email, { selected: request.selected });
  if (board) {
    const lead = await businessById(board.businessId);
    if (lead) await requestPreview(lead, founder.email, await noteBehindBoards(board));
    await record(founder.email, "asked for three new designs", { businessId: board.businessId, detail: request.feedback.slice(0, 500) });
  }
  revalidatePath("/admin", "layout");
  redirect(TURN_PATH);
}

/**
 * A founder wants every design that waits drawn again with the system the runner has now: each is replaced and gets a
 * job for three new ones, drawn as if for the first time. The runner takes those before any design it draws itself.
 */
export async function redrawAllWaitingAction() {
  const founder = await requireFounder();
  const boards = await redrawWaiting(founder.email);
  for (const board of boards) {
    const lead = await businessById(board.businessId);
    if (lead) await requestPreview(lead, founder.email, await noteBehindBoards(board));
  }
  if (boards.length) await record(founder.email, "asked for every waiting design to be drawn again", { detail: `${boards.length} designs` });
  revalidatePath("/admin", "layout");
}
