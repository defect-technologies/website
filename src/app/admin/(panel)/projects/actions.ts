"use server";

import { eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { mailboxes } from "@/server/db/schema";
import { syncPayments } from "@/server/integrations/stripe";
import { updateBusiness } from "@/server/leads/businesses";

export async function makeSenderAction(mailboxId: string) {
  const founder = await requireFounder();
  const database = await db();
  await database.update(mailboxes).set({ isSender: false }).where(ne(mailboxes.id, mailboxId));
  const [mailbox] = await database.update(mailboxes).set({ isSender: true }).where(eq(mailboxes.id, mailboxId)).returning();
  await record(founder.email, "changed sending inbox", { detail: mailbox?.email ?? "" });
  revalidatePath("/admin/projects");
}

export async function disconnectMailboxAction(mailboxId: string) {
  const founder = await requireFounder();
  const [removed] = await (await db()).delete(mailboxes).where(eq(mailboxes.id, mailboxId)).returning();
  await record(founder.email, "disconnected inbox", { detail: removed?.email ?? "" });
  revalidatePath("/admin/projects");
}

export async function syncPaymentsAction(): Promise<{ summary: string }> {
  await requireFounder();
  const result = await syncPayments();
  revalidatePath("/admin", "layout");
  if (result.state === "not_configured") return { summary: `Set ${result.needs.join(" and ")} first.` };
  if (result.state === "error") return { summary: result.message };
  return { summary: `${result.data.checkouts} checkouts since the last check, ${result.data.newClients} new clients.` };
}

/** Points a lead's emails at an earlier (or later) version of its preview. */
export async function switchPreviewVersionAction(form: FormData) {
  const founder = await requireFounder();
  const businessId = String(form.get("businessId") ?? "");
  const url = String(form.get("url") ?? "");
  if (!businessId || !url.startsWith("https://")) return;
  await updateBusiness(businessId, { previewUrl: url });
  await record(founder.email, "switched preview version", { businessId, detail: url });
  revalidatePath("/admin", "layout");
}
