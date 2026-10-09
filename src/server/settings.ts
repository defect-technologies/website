import "server-only";
import { eq } from "drizzle-orm";
import { DEFAULT_SETTINGS, type OutreachSettings } from "@/lib/emailTemplate";
import { db } from "./db/client";
import { settings } from "./db/schema";

const OUTREACH_KEY = "outreach";

export async function outreachSettings(): Promise<OutreachSettings> {
  const [row] = await (await db()).select().from(settings).where(eq(settings.key, OUTREACH_KEY));
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<OutreachSettings>) ?? {}) };
}

export async function saveOutreachSettings(value: OutreachSettings, updatedBy: string) {
  const now = new Date();
  await (await db())
    .insert(settings)
    .values({ key: OUTREACH_KEY, value, updatedBy, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy, updatedAt: now } });
}
