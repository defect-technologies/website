"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BOARD_LETTERS } from "@/lib/boards";
import { MAX_NOTE_TEXT } from "@/lib/review";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { chooseBoard, noteBehindBoards, redrawBoards } from "@/server/boards/store";
import { businessById } from "@/server/leads/businesses";
import { addTasteLessons } from "@/server/review/taste";
import { requestPreview } from "@/server/runner/jobs";
import { nextTurnHref } from "@/server/turn";

const Choice = z.object({
  id: z.string().uuid(),
  letter: z.enum(BOARD_LETTERS),
  feedback: z.string().trim().max(MAX_NOTE_TEXT).default(""),
  remember: z.boolean(),
});

/**
 * A founder chose one of a lead's three designs. The first choice stands (the other founder may have the page open
 * too). It queues the job that builds the site from that design, and the founder's words go with it, with any note the
 * job that made the boards was given. Words they asked to keep for every site also become a taste lesson.
 */
export async function chooseBoardAction(formData: FormData) {
  const founder = await requireFounder();
  const choice = Choice.parse({ id: formData.get("id"), letter: formData.get("letter"), feedback: formData.get("feedback") ?? "", remember: formData.get("remember") === "on" });
  const board = await chooseBoard(choice.id, choice.letter, choice.feedback, founder.email);
  if (board) {
    const lead = await businessById(board.businessId);
    if (lead) await requestPreview(lead, founder.email, await noteBehindBoards(board));
    if (choice.remember) await addTasteLessons([choice.feedback], founder.email, board.businessId);
    const name = board.options.find((option) => option.letter === choice.letter)?.name ?? "";
    await record(founder.email, "chose a design", { businessId: board.businessId, detail: `${choice.letter.toUpperCase()}: ${name}${choice.feedback ? `. ${choice.feedback}` : ""}`.slice(0, 500) });
  }
  revalidatePath("/admin", "layout");
  redirect(await nextTurnHref());
}

const Redraw = z.object({ id: z.string().uuid(), feedback: z.string().trim().max(MAX_NOTE_TEXT).default("") });

/**
 * A founder wants none of a lead's three designs. The first decision stands. It queues the job that draws three new
 * ones, which carries what the founder said about these and any note the job that made them was given.
 */
export async function redrawBoardsAction(formData: FormData) {
  const founder = await requireFounder();
  const request = Redraw.parse({ id: formData.get("id"), feedback: formData.get("feedback") ?? "" });
  const board = await redrawBoards(request.id, request.feedback, founder.email);
  if (board) {
    const lead = await businessById(board.businessId);
    if (lead) await requestPreview(lead, founder.email, await noteBehindBoards(board));
    await record(founder.email, "asked for three new designs", { businessId: board.businessId, detail: request.feedback.slice(0, 500) });
  }
  revalidatePath("/admin", "layout");
  redirect(await nextTurnHref());
}
