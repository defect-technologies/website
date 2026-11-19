import "server-only";
import { z } from "zod";
import { CRITIC_KINDS, CRITIC_TARGETS } from "@/lib/critics";
import { compileReviewNote, DEVICES, MAX_NOTE_TEXT, MAX_NOTES, POINTING_NOTE } from "@/lib/review";
import { record } from "../activity";
import { closeFlagsOn } from "../bots/flags";
import { db } from "../db/client";
import { previewReviews, type Business } from "../db/schema";
import { isDevelopment } from "../env";
import { businessById, updateBusiness } from "../leads/businesses";
import { activeJobFor, requestPreview } from "../runner/jobs";
import type { ReviewAsk } from "@/lib/reviewAsks";
import { reviewQuestionsFor } from "./askWriter";
import { recordProposalAnswer } from "./criticProposals";
import { withClasses } from "./noteClassifier";
import { splitSpokenNotes, type SplitNote } from "./noteWriter";

export type ReviewResult = { ok: boolean; message: string };

const Anchor = z.object({
  path: z.string().max(500),
  selector: z.string().max(500),
  tag: z.string().max(40),
  text: z.string().max(300),
});

const Note = z.object({
  id: z.string().max(64),
  text: z.string().trim().min(1).max(MAX_NOTE_TEXT),
  device: z.enum(DEVICES),
  path: z.string().max(500),
  anchor: Anchor.nullable(),
  kind: z.enum(CRITIC_KINDS).optional(),
  target: z.enum(CRITIC_TARGETS).optional(),
  proposalId: z.string().max(100).optional(),
});

export const Review = z.object({
  businessId: z.uuid(),
  // A local preview server is plain http, so development also takes http.
  previewUrl: z.url({ protocol: isDevelopment ? /^https?$/ : /^https$/ }),
  notes: z.array(Note).max(MAX_NOTES),
});
export type ReviewInput = z.input<typeof Review>;

type Checked = { error: string } | { error: null; lead: Business; review: z.infer<typeof Review> };

async function reviewedLead(input: ReviewInput): Promise<Checked> {
  const parsed = Review.safeParse(input);
  if (!parsed.success) return { error: "Some notes didn't come through. Check them and send again." };
  const lead = await businessById(parsed.data.businessId);
  if (!lead || lead.previewUrl !== parsed.data.previewUrl) return { error: "This preview changed while you were looking. Open the next one." };
  return { error: null, lead, review: parsed.data };
}

const REBUILDING_MESSAGE = "This preview is already rebuilding. Your notes are still here.";

/**
 * Sends the notes to the builder in one job. A note about the built preview is repaired on the site as it is (isRepair
 * in lib/previewJobs.ts, with the notes read back by repairNotesFor). The review keeps them with whoever wrote them.
 */
export async function sendReview(reviewer: string, input: ReviewInput): Promise<ReviewResult> {
  const checked = await reviewedLead(input);
  if (checked.error !== null) return { ok: false, message: checked.error };
  const { lead, review } = checked;
  if (!review.notes.length) return { ok: false, message: "Add a note first, or approve the preview." };
  if (await activeJobFor(lead.id)) return { ok: false, message: REBUILDING_MESSAGE };
  const notes = await withClasses(review.notes);
  const { job, created } = await requestPreview(lead, reviewer, compileReviewNote(notes, review.previewUrl));
  if (!created) return { ok: false, message: REBUILDING_MESSAGE };
  await (await db()).insert(previewReviews).values({ businessId: lead.id, previewUrl: review.previewUrl, verdict: "changes", notes, jobId: job.id, reviewedBy: reviewer });
  return { ok: true, message: `Sent ${review.notes.length} ${review.notes.length === 1 ? "note" : "notes"} to the builder.` };
}

/** The preview is good as it is: a held one moves to the outreach queue. */
export async function approveReview(reviewer: string, input: ReviewInput): Promise<ReviewResult> {
  const checked = await reviewedLead({ ...input, notes: [] });
  if (checked.error !== null) return { ok: false, message: checked.error };
  const { lead, review } = checked;
  if (lead.stage === "new") {
    await updateBusiness(lead.id, { stage: "preview_built" });
    await closeFlagsOn(lead.id, ["preview-review"], "The preview was approved on the review page.", reviewer);
  }
  await (await db()).insert(previewReviews).values({ businessId: lead.id, previewUrl: review.previewUrl, verdict: "approved", reviewedBy: reviewer });
  await record(reviewer, "approved the preview", { businessId: lead.id });
  return { ok: true, message: "Approved." };
}

/** Queues the kit-only rebuild for a preview built before pointing worked. */
export async function addPointing(reviewer: string, lead: Business | null): Promise<ReviewResult> {
  if (!lead) return { ok: false, message: "That lead isn't here any more." };
  const { created } = await requestPreview(lead, reviewer, POINTING_NOTE);
  return created ? { ok: true, message: "Updating this preview so you can point at it. It comes back here when it's built." } : { ok: false, message: "This preview is already rebuilding." };
}

/** The business a review names, when the ID is one. */
export async function businessFrom(businessId: unknown): Promise<Business | null> {
  const id = z.uuid().safeParse(businessId);
  return id.success ? businessById(id.data) : null;
}

const Spoken = z.string().trim().min(1).max(8000);

/** Splits what the reviewer said on the phone into separate notes. */
export async function splitSpoken(transcript: string): Promise<SplitNote[]> {
  const parsed = Spoken.safeParse(transcript);
  return parsed.success ? splitSpokenNotes(parsed.data) : [];
}

/** Claude's questions about a lead's current preview, with the preview they're about so the page can keep them. */
export async function asksFor(lead: Business | null): Promise<{ previewUrl: string; asks: ReviewAsk[] }> {
  if (!lead?.previewUrl) return { previewUrl: "", asks: [] };
  return { previewUrl: lead.previewUrl, asks: await reviewQuestionsFor(lead.id, lead.businessName, lead.previewUrl) };
}

const ProposalAnswer = z.object({ jobId: z.uuid(), proposalId: z.string().min(1).max(100), accepted: z.boolean() });
export type ProposalAnswerInput = z.input<typeof ProposalAnswer>;

/** The yes or no to one critic proposal, parsed, or null when it doesn't parse. */
export function proposalAnswerIn(input: ProposalAnswerInput) {
  const parsed = ProposalAnswer.safeParse(input);
  return parsed.success ? parsed.data : null;
}

/** Keeps the reviewer's yes or no to one critic proposal. The note itself is added in the browser. */
export async function answerProposal(reviewer: string, input: ProposalAnswerInput): Promise<boolean> {
  const answer = proposalAnswerIn(input);
  return answer ? recordProposalAnswer({ ...answer, answeredBy: reviewer }) : false;
}
