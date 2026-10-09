import "server-only";
import { eq } from "drizzle-orm";
import { DEFAULT_RUNNER_SETTINGS, type RunnerSettings } from "@/lib/previewJobs";
import { db } from "../db/client";
import { settings } from "../db/schema";

const RUNNER_KEY = "runner";

export async function runnerSettings(): Promise<RunnerSettings> {
  const [row] = await (await db()).select().from(settings).where(eq(settings.key, RUNNER_KEY));
  return { ...DEFAULT_RUNNER_SETTINGS, ...((row?.value as Partial<RunnerSettings>) ?? {}) };
}

export async function updateRunnerSettings(patch: Partial<RunnerSettings>, updatedBy: string): Promise<RunnerSettings> {
  const value = { ...(await runnerSettings()), ...patch };
  const now = new Date();
  await (await db())
    .insert(settings)
    .values({ key: RUNNER_KEY, value, updatedBy, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy, updatedAt: now } });
  return value;
}

/** The pause set when Claude's usage limit was hit, if it hasn't passed yet. */
export function activePause(current: RunnerSettings, now = new Date()): Date | null {
  if (!current.pausedUntil) return null;
  const until = new Date(current.pausedUntil);
  return until > now ? until : null;
}
