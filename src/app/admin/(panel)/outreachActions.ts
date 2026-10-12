"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFounder } from "@/server/auth/session";
import { record } from "@/server/activity";
import type { EmailDraft } from "@/lib/emailDraft";
import { businessById, updateBusiness } from "@/server/leads/businesses";
import type { EmailKind } from "@/server/outreach/compose";
import { sendOutreach, skipLead, type SendResult } from "@/server/outreach/send";

const MAX_RECIPIENTS = 20;
const ADDRESS = z.email();

const splitAddresses = (value: string) => [...new Set(value.split(/[\s,;]+/).map((part) => part.trim().toLowerCase()).filter(Boolean))];

function addressList(field: string) {
  return z.string().transform((value, context) => {
    const addresses = splitAddresses(value);
    const invalid = addresses.find((address) => !ADDRESS.safeParse(address).success);
    if (!invalid) return addresses;
    context.addIssue({ code: "custom", message: `"${invalid}" in ${field} isn't an email address.` });
    return z.NEVER;
  });
}

const Edits = z
  .object({
    to: addressList("To").refine((addresses) => addresses.length > 0, "Add at least one address to send it to."),
    cc: addressList("Cc"),
    bcc: addressList("Bcc"),
    subject: z.string().trim().min(1, "Write a subject.").max(300),
    body: z.string().trim().min(1, "Write the email."),
  })
  .refine(({ to, cc, bcc }) => to.length + cc.length + bcc.length <= MAX_RECIPIENTS, `Send to ${MAX_RECIPIENTS} people or fewer at once.`);

/** Doesn't revalidate, so the card can show "Sent" before the queue refreshes around it. */
export async function sendFromQueue(kind: EmailKind, id: string, problem?: string, draft?: EmailDraft): Promise<SendResult> {
  const founder = await requireFounder();
  const parsed = draft ? Edits.safeParse(draft) : undefined;
  if (parsed && !parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  return sendOutreach(kind, id, founder, problem?.trim() || undefined, parsed?.data);
}

const Draft = z.object({ to: z.string().max(2000), cc: z.string().max(2000), bcc: z.string().max(2000), subject: z.string().max(300), body: z.string().max(20000) });

/** Keeps the edits on the lead, unchecked, so either founder can pick them up later. Sending checks them. */
export async function saveDraft(kind: EmailKind, id: string, draft: EmailDraft): Promise<{ ok: boolean }> {
  const founder = await requireFounder();
  const parsed = Draft.safeParse(draft);
  if (!parsed.success) return { ok: false };
  await updateBusiness(id, { emailDraft: { ...parsed.data, kind, savedBy: founder.email, savedAt: new Date().toISOString() } });
  return { ok: true };
}

export async function discardDraft(id: string) {
  await requireFounder();
  await updateBusiness(id, { emailDraft: null });
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
