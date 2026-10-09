"use server";

import { revalidatePath } from "next/cache";
import { requireFounder } from "@/server/auth/session";
import { record } from "@/server/activity";
import { businessById, updateBusiness } from "@/server/leads/businesses";
import type { EmailKind } from "@/server/outreach/compose";
import { sendOutreach, skipLead, type SendResult } from "@/server/outreach/send";

/** Doesn't revalidate, so the card can show "Sent" before the queue refreshes around it. */
export async function sendFromQueue(kind: EmailKind, id: string, problem?: string): Promise<SendResult> {
  const founder = await requireFounder();
  return sendOutreach(kind, id, founder, problem?.trim() || undefined);
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
