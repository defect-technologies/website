"use server";

import { revalidatePath } from "next/cache";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { businessById, optOut } from "@/server/leads/businesses";
import { syncMail } from "@/server/mail/sync";
import { sendReply } from "@/server/mail/threads";

export type ReplyState = { ok: boolean; error?: string; sentAt?: number };

export async function replyAction(businessId: string, _previous: ReplyState, form: FormData): Promise<ReplyState> {
  const founder = await requireFounder();
  const result = await sendReply(businessId, String(form.get("body") ?? ""), founder);
  if (result.ok) revalidatePath("/admin/messages");
  return result.ok ? { ok: true, sentAt: Date.now() } : { ok: false, error: result.error };
}

export async function checkMailAction(): Promise<{ summary: string }> {
  await requireFounder();
  const result = await syncMail();
  revalidatePath("/admin", "layout");
  if (result.mailboxes === 0) return { summary: "No inbox is connected yet. Connect one on the Projects page." };
  if (result.errors.length > 0) return { summary: result.errors.join(" ") };
  return { summary: result.newMessages === 1 ? "1 new message." : `${result.newMessages} new messages.` };
}

export async function optOutAction(businessId: string) {
  const founder = await requireFounder();
  const business = await businessById(businessId);
  if (!business) return;
  await optOut(business, `Opted out by reply, marked by ${founder.email}`);
  await record(founder.email, "opted out", { businessId, detail: business.email });
  revalidatePath("/admin", "layout");
}
