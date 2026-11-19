"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import type { ReviewAsk } from "@/lib/reviewAsks";
import type { SplitNote } from "@/server/review/noteWriter";
import { addTasteLessons, restoreTasteLesson, retireTasteLesson, updateTasteLesson } from "@/server/review/taste";
import { addPointing, answerProposal, approveReview, asksFor, businessFrom, type ProposalAnswerInput, type ReviewInput, type ReviewResult, sendReview, splitSpoken } from "@/server/review/verdicts";

export type { ReviewResult };

/** Sends the notes to the builder as one rebuild. The review keeps them with the founder who wrote them. */
export async function sendReviewAction(input: ReviewInput): Promise<ReviewResult> {
  const founder = await requireFounder();
  const result = await sendReview(founder.email, input);
  if (result.ok) revalidatePath("/admin", "layout");
  return result;
}

/** The preview is good as it is: a held one moves to the outreach queue. */
export async function approveReviewAction(input: ReviewInput): Promise<ReviewResult> {
  const founder = await requireFounder();
  const result = await approveReview(founder.email, input);
  if (result.ok) revalidatePath("/admin", "layout");
  return result;
}

/** Splits what the founder said on the phone into separate notes. */
export async function splitSpokenNotesAction(transcript: string): Promise<SplitNote[]> {
  await requireFounder();
  return splitSpoken(transcript);
}

/** Claude's questions about a lead's current preview, with the preview they're about so the page can keep them. */
export async function reviewAsksAction(businessId: string): Promise<{ previewUrl: string; asks: ReviewAsk[] }> {
  await requireFounder();
  return asksFor(await businessFrom(businessId));
}

/** Keeps the founder's yes or no to one critic proposal. The note itself is added in the browser. */
export async function answerProposalAction(input: ProposalAnswerInput): Promise<boolean> {
  const founder = await requireFounder();
  return answerProposal(founder.email, input);
}

/** Queues the kit-only rebuild for a preview built before pointing worked. */
export async function addPointingAction(businessId: string): Promise<ReviewResult> {
  const founder = await requireFounder();
  // No revalidation here: the page shows its message, then opens the next preview itself.
  return addPointing(founder.email, await businessFrom(businessId));
}

const LessonId = z.uuid();

export async function addTasteLessonAction(form: FormData) {
  const founder = await requireFounder();
  await addTasteLessons([String(form.get("text") ?? "")], founder.email);
  revalidatePath("/admin/setup/taste");
}

export async function updateTasteLessonAction(form: FormData) {
  const founder = await requireFounder();
  const id = LessonId.safeParse(form.get("id"));
  if (id.success) await updateTasteLesson(id.data, String(form.get("text") ?? ""), founder.email);
  revalidatePath("/admin/setup/taste");
}

export async function retireTasteLessonAction(form: FormData) {
  const founder = await requireFounder();
  const id = LessonId.safeParse(form.get("id"));
  if (!id.success) return;
  await retireTasteLesson(id.data, founder.email);
  await record(founder.email, "retired a taste lesson", { detail: id.data });
  revalidatePath("/admin/setup/taste");
}

export async function restoreTasteLessonAction(form: FormData) {
  const founder = await requireFounder();
  const id = LessonId.safeParse(form.get("id"));
  if (id.success) await restoreTasteLesson(id.data, founder.email);
  revalidatePath("/admin/setup/taste");
}
