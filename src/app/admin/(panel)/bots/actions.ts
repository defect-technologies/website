"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BOTS, BOT_LABEL } from "@/lib/bots";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { createBotKey, revokeBotKey } from "@/server/bots/keys";
import { updateRunnerSettings } from "@/server/runner/settings";

export type CreateKeyState = { key: string; bot: string; error: string };

const CreateKey = z.object({ bot: z.enum(BOTS), name: z.string().trim().min(1, "Give the key a name, like Grok Bot.").max(60) });

export async function createBotKeyAction(_previous: CreateKeyState, form: FormData): Promise<CreateKeyState> {
  const founder = await requireFounder();
  const parsed = CreateKey.safeParse({ bot: form.get("bot"), name: form.get("name") });
  if (!parsed.success) return { key: "", bot: String(form.get("bot") ?? ""), error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { key } = await createBotKey(parsed.data.bot, parsed.data.name, founder.email);
  await record(founder.email, "created a bot key", { detail: `${BOT_LABEL[parsed.data.bot]}: ${parsed.data.name}` });
  revalidatePath("/admin/bots");
  return { key, bot: parsed.data.bot, error: "" };
}

export async function revokeBotKeyAction(form: FormData) {
  const founder = await requireFounder();
  const revoked = await revokeBotKey(String(form.get("id") ?? ""));
  if (revoked) await record(founder.email, "revoked a bot key", { detail: `${BOT_LABEL[revoked.bot]}: ${revoked.name}` });
  revalidatePath("/admin/bots");
}

const RunnerForm = z.object({ dailyCap: z.coerce.number().int().min(0).max(100), outreachPicksPreviews: z.boolean(), autoQueue: z.boolean() });

/** The daily build cap, whether new leads are built automatically, and whether the Outreach bot may queue previews. */
export async function saveRunnerSettingsAction(form: FormData) {
  const founder = await requireFounder();
  const parsed = RunnerForm.safeParse({ dailyCap: form.get("dailyCap"), outreachPicksPreviews: form.get("outreachPicksPreviews") === "on", autoQueue: form.get("autoQueue") === "on" });
  if (!parsed.success) return;
  await updateRunnerSettings(parsed.data, founder.email);
  await record(founder.email, "changed preview runner settings", { detail: `${parsed.data.dailyCap} builds a day; Outreach ${parsed.data.outreachPicksPreviews ? "can" : "can't"} request previews; new leads ${parsed.data.autoQueue ? "are" : "aren't"} built automatically` });
  revalidatePath("/admin", "layout");
}

/** Lifts the pause set when Claude's usage limit was hit. */
export async function resumeRunnerAction() {
  const founder = await requireFounder();
  await updateRunnerSettings({ pausedUntil: null }, founder.email);
  await record(founder.email, "resumed preview builds");
  revalidatePath("/admin", "layout");
}
