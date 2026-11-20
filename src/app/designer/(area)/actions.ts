"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { record } from "@/server/activity";
import { DESIGNER_HOME, endDesignerSession, requireDesigner, SIGN_IN_PATH } from "@/server/auth/designerSession";
import { type BoardDecisionKind, boardIdIn, decideBoard } from "@/server/boards/decide";
import { boardById } from "@/server/boards/store";
import { claimBoard, owns } from "@/server/designers/claims";

const refresh = () => revalidatePath("/designer", "layout");

/** A designer takes the business behind a waiting design. Another designer who got there first keeps it. */
export async function claimAction(formData: FormData) {
  const designer = await requireDesigner();
  const id = boardIdIn(formData);
  const { result, board } = await claimBoard(id, designer.id);
  if (result === "claimed" && board) await record(designer.email, "took a design", { businessId: board.businessId });
  refresh();
  redirect(result === "claimed" || result === "yours" ? `/designer/designs/${id}` : `/designer/pool?missed=${result}`);
}

/** A decision on a board of a business the designer claimed. A board of anyone else's business is refused. */
async function decideOwn(kind: BoardDecisionKind, formData: FormData) {
  const designer = await requireDesigner();
  const board = await boardById(boardIdIn(formData));
  if (!board || !(await owns(designer.id, board.businessId))) redirect(DESIGNER_HOME);
  await decideBoard(kind, formData, designer.email);
  refresh();
  redirect(DESIGNER_HOME);
}

export async function chooseAsDesignerAction(formData: FormData) {
  await decideOwn("choose", formData);
}

export async function reviseAsDesignerAction(formData: FormData) {
  await decideOwn("revise", formData);
}

export async function redrawAsDesignerAction(formData: FormData) {
  await decideOwn("redraw", formData);
}

export async function designerSignOutAction() {
  await endDesignerSession();
  redirect(SIGN_IN_PATH);
}
