"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { saveSpotCheckReview, saveSpotCheckSettings, skipSpotCheck } from "@/server/spotChecks";

const Rating = z.coerce.number().int().min(1).max(5);
const Review = z.object({
  id: z.uuid(),
  copyRating: Rating,
  typographyRating: Rating,
  layoutRating: Rating,
  note: z.string().trim().max(4000),
});

/** Saves a founder's ratings and note on one spot check. */
export async function saveSpotCheckAction(form: FormData) {
  const founder = await requireFounder();
  const parsed = Review.safeParse({
    id: form.get("id"),
    copyRating: form.get("copyRating"),
    typographyRating: form.get("typographyRating"),
    layoutRating: form.get("layoutRating"),
    note: form.get("note") ?? "",
  });
  if (!parsed.success) return;
  const { id, ...review } = parsed.data;
  const saved = await saveSpotCheckReview(id, review, founder.email);
  if (saved) {
    const ratings = `copy ${review.copyRating}, typography ${review.typographyRating}, layout ${review.layoutRating}`;
    await record(founder.email, "spot-checked a preview", { businessId: saved.businessId, detail: review.note ? `${ratings}: ${review.note}` : ratings });
  }
  revalidatePath("/admin", "layout");
}

export async function skipSpotCheckAction(form: FormData) {
  const founder = await requireFounder();
  const skipped = await skipSpotCheck(String(form.get("id") ?? ""), founder.email);
  if (skipped) await record(founder.email, "skipped a spot check", { businessId: skipped.businessId, detail: skipped.previewUrl });
  revalidatePath("/admin", "layout");
}

const SettingsForm = z.object({ percent: z.coerce.number().min(0).max(100) });

/** The share of finished previews picked for a spot check. */
export async function saveSpotCheckSettingsAction(form: FormData) {
  const founder = await requireFounder();
  const parsed = SettingsForm.safeParse({ percent: form.get("percent") });
  if (!parsed.success) return;
  await saveSpotCheckSettings({ share: parsed.data.percent / 100 }, founder.email);
  await record(founder.email, "changed spot check settings", { detail: `${parsed.data.percent}% of finished previews are picked` });
  revalidatePath("/admin/spot-checks");
}
