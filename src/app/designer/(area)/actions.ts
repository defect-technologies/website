"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { record } from "@/server/activity";
import { DESIGNER_HOME, endDesignerSession, requireDesigner, SIGN_IN_PATH } from "@/server/auth/designerSession";
import { type BoardDecisionKind, boardIdIn, decideBoard } from "@/server/boards/decide";
import { claimBoard, owns } from "@/server/designers/claims";

const refresh = () => revalidatePath("/designer", "layout");

/** What the To do page tells the designer after each decision: what happens now. */
const DONE = { choose: "building", redraw: "drawing" } as const satisfies Partial<Record<BoardDecisionKind, string>>;

/**
 * A decision on a waiting design. The first designer to decide on a business's designs makes it theirs, so a design
 * another designer already decided on is refused.
 */
async function decideOwn(kind: keyof typeof DONE, formData: FormData) {
  const designer = await requireDesigner();
  const { result, board } = await claimBoard(boardIdIn(formData), designer.id);
  if (!board || result === "taken") redirect(`${DESIGNER_HOME}?missed=taken`);
  if (result === "gone" && !(await owns(designer.id, board.businessId))) redirect(`${DESIGNER_HOME}?missed=gone`);
  if (result === "claimed") await record(designer.email, "took a design", { businessId: board.businessId });
  await decideBoard(kind, formData, designer.email);
  refresh();
  redirect(`${DESIGNER_HOME}?done=${DONE[kind]}`);
}

export async function chooseAsDesignerAction(formData: FormData) {
  await decideOwn("choose", formData);
}

export async function redrawAsDesignerAction(formData: FormData) {
  await decideOwn("redraw", formData);
}

export async function designerSignOutAction() {
  await endDesignerSession();
  redirect(SIGN_IN_PATH);
}
