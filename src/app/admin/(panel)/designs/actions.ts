"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { decideBoard } from "@/server/boards/decide";
import { clearWaiting, noteBehindBoards, redrawWaiting } from "@/server/boards/store";
import { businessById } from "@/server/leads/businesses";
import { requestPreview } from "@/server/runner/jobs";
import { TURN_PATH } from "@/lib/turn";

/**
 * A founder chose one of a lead's three designs. It queues the job that builds the site from that design, and the
 * founder's words go with it. Every note is kept with the founder who wrote it.
 */
export async function chooseBoardAction(formData: FormData) {
  const founder = await requireFounder();
  await decideBoard("choose", formData, founder.email);
  revalidatePath("/admin", "layout");
  redirect(TURN_PATH);
}

/** A founder liked one of a lead's designs and wants it revised with their words before anything is built. */
export async function reviseBoardAction(formData: FormData) {
  const founder = await requireFounder();
  await decideBoard("revise", formData, founder.email);
  revalidatePath("/admin", "layout");
  redirect(TURN_PATH);
}

/** A founder wants none of a lead's three designs, and three new ones drawn with what they said. */
export async function redrawBoardsAction(formData: FormData) {
  const founder = await requireFounder();
  await decideBoard("redraw", formData, founder.email);
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

/**
 * A founder wants every waiting design gone without new ones: each is cleared and nothing is queued, so the runner
 * draws designs again only as Setup > Runner allows. Nothing is learned from them.
 */
export async function clearAllWaitingAction() {
  const founder = await requireFounder();
  const boards = await clearWaiting(founder.email);
  if (boards.length) await record(founder.email, "cleared every waiting design", { detail: `${boards.length} designs` });
  revalidatePath("/admin", "layout");
}
