"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { saveOutreachSettings } from "@/server/settings";

export type TemplateResult = { ok: boolean; message: string };

const stripeLink = z.union([z.literal(""), z.url({ protocol: /^https$/, hostname: /^(buy\.stripe\.com|checkout\.stripe\.com)$/ })]);

const Settings = z.object({
  subject: z.string().trim().min(1).max(200),
  firstEmail: z.string().trim().min(1).max(2000),
  followUp: z.string().trim().min(1).max(2000),
  senderName: z.string().trim().min(1).max(80),
  mailingAddress: z.string().trim().max(200),
  checkout59: stripeLink,
  checkout79: stripeLink,
  dailyLimit: z.coerce.number().int().min(1).max(50),
  followUpAfterDays: z.coerce.number().int().min(1).max(30),
});

export async function saveTemplateAction(_previous: TemplateResult, form: FormData): Promise<TemplateResult> {
  const founder = await requireFounder();
  const parsed = Settings.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: z.prettifyError(parsed.error) };
  const { checkout59, checkout79, ...rest } = parsed.data;
  await saveOutreachSettings({ ...rest, checkoutLinks: { "59": checkout59, "79": checkout79 } }, founder.email);
  await record(founder.email, "edited the outreach template");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Saved. Every email in the queue now uses this." };
}
