"use server";

import { revalidatePath } from "next/cache";
import type { ReviewAsk } from "@/lib/reviewAsks";
import { requireDesigner } from "@/server/auth/designerSession";
import type { Business } from "@/server/db/schema";
import { owns } from "@/server/designers/claims";
import type { SplitNote } from "@/server/review/noteWriter";
import { jobById } from "@/server/runner/jobs";
import { addPointing, answerProposal, approveReview, asksFor, businessFrom, type ProposalAnswerInput, proposalAnswerIn, type ReviewInput, type ReviewResult, sendReview, splitSpoken } from "@/server/review/verdicts";

const NOT_YOURS: ReviewResult = { ok: false, message: "This design isn't one of yours." };

/** The signed-in designer and the business, when the business is one they claimed. */
async function ownLead(businessId: unknown): Promise<{ email: string; lead: Business } | null> {
  const designer = await requireDesigner();
  const lead = await businessFrom(businessId);
  return lead && (await owns(designer.id, lead.id)) ? { email: designer.email, lead } : null;
}

/** Sends the designer's notes to the builder, which repairs them on the built site. */
export async function sendDesignerReviewAction(input: ReviewInput): Promise<ReviewResult> {
  const own = await ownLead(input?.businessId);
  if (!own) return NOT_YOURS;
  const result = await sendReview(own.email, input);
  if (result.ok) revalidatePath("/designer", "layout");
  return result;
}

/** The designer approves the preview as it is, the same way a founder does. */
export async function approveDesignerReviewAction(input: ReviewInput): Promise<ReviewResult> {
  const own = await ownLead(input?.businessId);
  if (!own) return NOT_YOURS;
  const result = await approveReview(own.email, input);
  if (result.ok) revalidatePath("/designer", "layout");
  return result;
}

export async function addDesignerPointingAction(businessId: string): Promise<ReviewResult> {
  const own = await ownLead(businessId);
  return own ? addPointing(own.email, own.lead) : NOT_YOURS;
}

export async function splitDesignerNotesAction(transcript: string): Promise<SplitNote[]> {
  await requireDesigner();
  return splitSpoken(transcript);
}

export async function designerAsksAction(businessId: string): Promise<{ previewUrl: string; asks: ReviewAsk[] }> {
  const own = await ownLead(businessId);
  return asksFor(own?.lead ?? null);
}

/** The designer's yes or no to a critic proposal on one of their own previews. */
export async function answerDesignerProposalAction(input: ProposalAnswerInput): Promise<boolean> {
  const designer = await requireDesigner();
  const answer = proposalAnswerIn(input);
  if (!answer) return false;
  const job = await jobById(answer.jobId);
  const own = await ownLead(job?.businessId);
  return own ? answerProposal(designer.email, answer) : false;
}
