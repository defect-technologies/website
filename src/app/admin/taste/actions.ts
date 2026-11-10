"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_NOTE_TEXT, MAX_TRANSCRIPT, TASTE_CATEGORIES, TASTE_SCOPES, TASTE_VERDICTS, type TasteNote } from "@/lib/taste";
import { requireFounder } from "@/server/auth/session";
import { saveTasteReview, type TasteReviewResult } from "@/server/taste";
import { draftTasteNotes } from "@/server/tasteWriter";

const Transcript = z.string().trim().min(1).max(MAX_TRANSCRIPT);

/** Splits what the founder said into notes for them to check before sending. */
export async function draftNotesAction(transcript: string, businessName: string): Promise<TasteNote[]> {
  await requireFounder();
  const parsed = Transcript.safeParse(transcript);
  if (!parsed.success) return [];
  return draftTasteNotes(parsed.data, businessName.slice(0, 200));
}

const Review = z.object({
  jobId: z.uuid(),
  previewUrl: z.url({ protocol: /^https$/ }).max(500),
  verdict: z.enum(TASTE_VERDICTS),
  transcript: z.string().trim().max(MAX_TRANSCRIPT),
  notes: z.array(z.object({ scope: z.enum(TASTE_SCOPES), category: z.enum(TASTE_CATEGORIES), text: z.string().trim().min(1).max(MAX_NOTE_TEXT) })).max(30),
});

export async function sendReviewAction(review: z.input<typeof Review>): Promise<TasteReviewResult> {
  const founder = await requireFounder();
  const parsed = Review.safeParse(review);
  if (!parsed.success) return { saved: false, rebuilt: false, rules: 0 };
  const result = await saveTasteReview(parsed.data, founder.email);
  revalidatePath("/admin", "layout");
  return result;
}
