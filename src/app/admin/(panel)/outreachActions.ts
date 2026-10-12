"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFounder } from "@/server/auth/session";
import { record } from "@/server/activity";
import { businessById, updateBusiness } from "@/server/leads/businesses";
import type { EmailKind } from "@/server/outreach/compose";
import { sendOutreach, skipLead, type EmailEdits, type SendResult } from "@/server/outreach/send";

const Edits = z.object({
  to: z.email("That email address doesn't look right.").trim().toLowerCase().max(200),
  subject: z.string().trim().min(1, "Write a subject.").max(300),
  body: z.string().trim().min(1, "Write the email."),
});

/** Doesn't revalidate, so the card can show "Sent" before the queue refreshes around it. */
export async function sendFromQueue(kind: EmailKind, id: string, problem?: string, edits?: EmailEdits): Promise<SendResult> {
  const founder = await requireFounder();
  const parsed = edits ? Edits.safeParse(edits) : undefined;
  if (parsed && !parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  return sendOutreach(kind, id, founder, problem?.trim() || undefined, parsed?.data);
}

export async function skipFromQueue(id: string): Promise<{ ok: boolean }> {
  const founder = await requireFounder();
  const business = await businessById(id);
  if (!business) return { ok: false };
  await skipLead(business, founder, "Skipped from the outreach queue.");
  return { ok: true };
}

export async function undoSkip(id: string) {
  const founder = await requireFounder();
  await updateBusiness(id, { stage: "preview_built" });
  await record(founder.email, "put back in the queue", { businessId: id });
  revalidatePath("/admin", "layout");
}
