"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { compileReviewNote, DEVICES, MAX_NOTE_TEXT, MAX_NOTES, NOTE_SCOPES } from "@/lib/review";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { closeFlagsOn } from "@/server/bots/flags";
import { db } from "@/server/db/client";
import { isDevelopment } from "@/server/env";
import { previewReviews, type Business } from "@/server/db/schema";
import { businessById, updateBusiness } from "@/server/leads/businesses";
import type { ReviewAsk } from "@/lib/reviewAsks";
import { writeReviewAsks } from "@/server/review/askWriter";
import { splitSpokenNotes, type SplitNote } from "@/server/review/noteWriter";
import { addTasteLessons, restoreTasteLesson, retireTasteLesson, updateTasteLesson } from "@/server/review/taste";
import { requestPreview } from "@/server/runner/jobs";

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
  scope: z.enum(NOTE_SCOPES),
  device: z.enum(DEVICES),
  path: z.string().max(500),
  anchor: Anchor.nullable(),
});

const Review = z.object({
  businessId: z.uuid(),
  // A local preview server is plain http, so development also takes http.
  previewUrl: z.url({ protocol: isDevelopment ? /^https?$/ : /^https$/ }),
  notes: z.array(Note).max(MAX_NOTES),
});

type Checked = { error: string } | { error: null; founder: Awaited<ReturnType<typeof requireFounder>>; lead: Business; review: z.infer<typeof Review> };

async function reviewedLead(input: z.input<typeof Review>): Promise<Checked> {
  const founder = await requireFounder();
  const parsed = Review.safeParse(input);
  if (!parsed.success) return { error: "Some notes didn't come through. Check them and send again." };
  const lead = await businessById(parsed.data.businessId);
  if (!lead || lead.previewUrl !== parsed.data.previewUrl) return { error: "This preview changed while you were looking. Open the next one." };
  return { error: null, founder, lead, review: parsed.data };
}

/** Sends the notes to the builder as one rebuild, and keeps every "every site" note as a taste lesson. */
export async function sendReviewAction(input: z.input<typeof Review>): Promise<ReviewResult> {
  const checked = await reviewedLead(input);
  if (checked.error !== null) return { ok: false, message: checked.error };
  const { founder, lead, review } = checked;
  if (!review.notes.length) return { ok: false, message: "Add a note first, or approve the preview." };
  const { job, created } = await requestPreview(lead, founder.email, compileReviewNote(review.notes, review.previewUrl));
  if (!created) return { ok: false, message: "This preview is already rebuilding. Your notes are still here." };
  await addTasteLessons(review.notes.filter((note) => note.scope === "every").map((note) => note.text), founder.email, lead.id);
  await (await db()).insert(previewReviews).values({ businessId: lead.id, previewUrl: review.previewUrl, verdict: "changes", notes: review.notes, jobId: job.id, reviewedBy: founder.email });
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Sent ${review.notes.length} ${review.notes.length === 1 ? "note" : "notes"} to the builder.` };
}

/** The preview is good as it is: a held one moves to the outreach queue. */
export async function approveReviewAction(input: z.input<typeof Review>): Promise<ReviewResult> {
  const checked = await reviewedLead({ ...input, notes: [] });
  if (checked.error !== null) return { ok: false, message: checked.error };
  const { founder, lead, review } = checked;
  if (lead.stage === "new") {
    await updateBusiness(lead.id, { stage: "preview_built" });
    await closeFlagsOn(lead.id, ["preview-review"], "A founder approved the preview on the review page.", founder.email);
  }
  await (await db()).insert(previewReviews).values({ businessId: lead.id, previewUrl: review.previewUrl, verdict: "approved", reviewedBy: founder.email });
  await record(founder.email, "approved the preview", { businessId: lead.id });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Approved." };
}

const Spoken = z.string().trim().min(1).max(8000);

/** Splits what the founder said on the phone into separate notes, each for this site or every site. */
export async function splitSpokenNotesAction(transcript: string): Promise<SplitNote[]> {
  await requireFounder();
  const parsed = Spoken.safeParse(transcript);
  return parsed.success ? splitSpokenNotes(parsed.data) : [];
}

/** Claude's questions about a lead's current preview, with the preview they're about so the page can keep them. */
export async function reviewAsksAction(businessId: string): Promise<{ previewUrl: string; asks: ReviewAsk[] }> {
  await requireFounder();
  const id = z.uuid().safeParse(businessId);
  const lead = id.success ? await businessById(id.data) : null;
  if (!lead?.previewUrl) return { previewUrl: "", asks: [] };
  return { previewUrl: lead.previewUrl, asks: await writeReviewAsks(lead.businessName, lead.previewUrl) };
}

/** The rebuild a preview gets so the review page can point at its elements; it only moves the site to the newest kit. */
const POINTING_NOTE =
  "Rebuild only to take the newest site-kit, so the founders' review page can point at elements in this preview. Keep the design, content, pages and wording exactly as they are.";

/** Queues the kit-only rebuild for a preview built before pointing worked. */
export async function addPointingAction(businessId: string): Promise<ReviewResult> {
  const founder = await requireFounder();
  const id = z.uuid().safeParse(businessId);
  const lead = id.success ? await businessById(id.data) : null;
  if (!lead) return { ok: false, message: "That lead isn't here any more." };
  // No revalidation here: the page shows its message, then opens the next preview itself.
  const { created } = await requestPreview(lead, founder.email, POINTING_NOTE);
  return created ? { ok: true, message: "Updating this preview so you can point at it. It comes back here when it's built." } : { ok: false, message: "This preview is already rebuilding." };
}

const LessonId = z.uuid();

export async function addTasteLessonAction(form: FormData) {
  const founder = await requireFounder();
  await addTasteLessons([String(form.get("text") ?? "")], founder.email);
  revalidatePath("/admin/setup/taste");
}

export async function updateTasteLessonAction(form: FormData) {
  await requireFounder();
  const id = LessonId.safeParse(form.get("id"));
  if (id.success) await updateTasteLesson(id.data, String(form.get("text") ?? ""));
  revalidatePath("/admin/setup/taste");
}

export async function retireTasteLessonAction(form: FormData) {
  const founder = await requireFounder();
  const id = LessonId.safeParse(form.get("id"));
  if (!id.success) return;
  await retireTasteLesson(id.data);
  await record(founder.email, "retired a taste lesson", { detail: id.data });
  revalidatePath("/admin/setup/taste");
}

export async function restoreTasteLessonAction(form: FormData) {
  await requireFounder();
  const id = LessonId.safeParse(form.get("id"));
  if (id.success) await restoreTasteLesson(id.data);
  revalidatePath("/admin/setup/taste");
}
