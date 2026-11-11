"use server";

import { revalidatePath } from "next/cache";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { CriticSettingsInput, updateCriticSettings } from "@/server/review/criticSettings";

const SwitchesAndMinutes = CriticSettingsInput.pick({ enabled: true, minutes: true, apply: true });

/** The master switch, the critics' minutes, and the kinds the builder applies without a founder. */
export async function saveCriticSettingsAction(form: FormData) {
  const founder = await requireFounder();
  const parsed = SwitchesAndMinutes.safeParse({ enabled: form.get("enabled") === "on", minutes: Number(form.get("minutes")), apply: form.getAll("apply") });
  if (!parsed.success) return;
  await updateCriticSettings(parsed.data, founder.email);
  await record(founder.email, "changed critic settings", { detail: `${parsed.data.enabled ? "On" : "Off"}; ${parsed.data.minutes} minutes; applies without a founder: ${parsed.data.apply.join(", ") || "nothing"}` });
  revalidatePath("/admin/setup/critics");
}
