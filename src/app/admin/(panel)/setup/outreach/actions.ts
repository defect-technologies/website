"use server";

import { eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { mailboxes } from "@/server/db/schema";
import { saveOutreachSettings } from "@/server/settings";

export type TemplateResult = { ok: boolean; message: string };

const Settings = z.object({
  subject: z.string().trim().min(1).max(200),
  firstEmail: z.string().trim().min(1).max(2000),
  followUp: z.string().trim().min(1).max(2000),
  requestSubject: z.string().trim().min(1).max(200),
  requestEmail: z.string().trim().min(1).max(2000),
  senderName: z.string().trim().min(1).max(80),
  mailingAddress: z.string().trim().max(200),
  dailyLimit: z.coerce.number().int().min(1).max(50),
  followUpAfterDays: z.coerce.number().int().min(1).max(30),
});

export async function saveTemplateAction(_previous: TemplateResult, form: FormData): Promise<TemplateResult> {
  const founder = await requireFounder();
  const parsed = Settings.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: z.prettifyError(parsed.error) };
  await saveOutreachSettings(parsed.data, founder.email);
  await record(founder.email, "edited the outreach template");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Saved." };
}

export async function makeSenderAction(mailboxId: string) {
  const founder = await requireFounder();
  const database = await db();
  await database.update(mailboxes).set({ isSender: false }).where(ne(mailboxes.id, mailboxId));
  const [mailbox] = await database.update(mailboxes).set({ isSender: true }).where(eq(mailboxes.id, mailboxId)).returning();
  await record(founder.email, "changed sending inbox", { detail: mailbox?.email ?? "" });
  revalidatePath("/admin", "layout");
}

export async function disconnectMailboxAction(mailboxId: string) {
  const founder = await requireFounder();
  const [removed] = await (await db()).delete(mailboxes).where(eq(mailboxes.id, mailboxId)).returning();
  await record(founder.email, "disconnected inbox", { detail: removed?.email ?? "" });
  revalidatePath("/admin", "layout");
}
