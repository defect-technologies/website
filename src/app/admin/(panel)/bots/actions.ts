"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BOTS, BOT_LABEL } from "@/lib/bots";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { createBotKey, revokeBotKey } from "@/server/bots/keys";

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
