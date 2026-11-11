import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { CRITIC_KINDS, type CriticSettings, DEFAULT_CRITIC_SETTINGS, MAX_CRITIC_MINUTES, MAX_CRITIC_NOTES, MIN_CRITIC_MINUTES } from "@/lib/critics";
import { db } from "../db/client";
import { settings } from "../db/schema";

const CRITICS_KEY = "critics";

export const CriticSettingsInput = z.object({
  enabled: z.boolean(),
  minutes: z.number().int().min(MIN_CRITIC_MINUTES).max(MAX_CRITIC_MINUTES),
  apply: z.array(z.enum(CRITIC_KINDS)).transform((kinds) => CRITIC_KINDS.filter((kind) => kinds.includes(kind))),
  maxNotes: z.number().int().min(1).max(MAX_CRITIC_NOTES),
  secondBuilder: z.boolean(),
});

/** What is stored, with defaults under anything missing or no longer valid, so an odd value can never switch critics on. */
export async function criticSettings(): Promise<CriticSettings> {
  const [row] = await (await db()).select().from(settings).where(eq(settings.key, CRITICS_KEY));
  const merged = { ...DEFAULT_CRITIC_SETTINGS, ...((row?.value as Partial<CriticSettings>) ?? {}) };
  const parsed = CriticSettingsInput.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_CRITIC_SETTINGS;
}

export async function updateCriticSettings(patch: Partial<CriticSettings>, updatedBy: string): Promise<CriticSettings> {
  const value = CriticSettingsInput.parse({ ...(await criticSettings()), ...patch });
  const now = new Date();
  await (await db())
    .insert(settings)
    .values({ key: CRITICS_KEY, value, updatedBy, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy, updatedAt: now } });
  return value;
}
