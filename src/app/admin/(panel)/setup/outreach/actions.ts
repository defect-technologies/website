"use server";

import { eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { mailboxes } from "@/server/db/schema";
import { listFromLines, MOST_SEARCHES_PER_NIGHT } from "@/lib/research";
import { updateResearchSettings } from "@/server/research";
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
  autoSend: z.preprocess((value) => value === "on", z.boolean()),
  callLink: z.union([z.literal(""), z.url({ protocol: /^https$/, error: "Use the booking page's https:// address." })]),
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

export type ResearchResult = { ok: boolean; message: string };

const ResearchForm = z.object({
  enabled: z.boolean(),
  niches: z.array(z.string().max(120)).max(40),
  areas: z.array(z.string().max(120)).max(40),
  searchesPerNight: z.coerce.number().int().min(1).max(MOST_SEARCHES_PER_NIGHT),
});

/** The niches and areas the nightly lead search goes through, and whether it adds leads. */
export async function saveResearchAction(_previous: ResearchResult, form: FormData): Promise<ResearchResult> {
  const founder = await requireFounder();
  const parsed = ResearchForm.safeParse({
    enabled: form.get("enabled") === "on",
    niches: listFromLines(String(form.get("niches") ?? "")),
    areas: listFromLines(String(form.get("areas") ?? "")),
    searchesPerNight: form.get("searchesPerNight"),
  });
  if (!parsed.success) return { ok: false, message: z.prettifyError(parsed.error) };
  if (parsed.data.enabled && !(parsed.data.niches.length && parsed.data.areas.length)) return { ok: false, message: "Add at least one niche and one area to search." };
  await updateResearchSettings(parsed.data, founder.email);
  await record(founder.email, "changed the nightly lead search", { detail: `${parsed.data.enabled ? "on" : "off"}; ${parsed.data.niches.length} niches in ${parsed.data.areas.length} areas, ${parsed.data.searchesPerNight} a night` });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Saved." };
}
