import type { PreviewJob } from "@/server/db/schema";
import { BOT_LABEL, type Bot } from "./bots";
import { founderName } from "./founders";

/** Used for ETAs until a few builds have finished with a recorded duration. */
export const DEFAULT_BUILD_MINUTES = 60;

export type StepParts = { done: number; total: number; words: string };

/** "4/6 Designing and building with Claude (this takes a while)" is step 4 of 6, "Designing and building with Claude". */
export function stepParts(step: string): StepParts {
  const match = /^(\d+)\/(\d+)\s+(.*)$/.exec(step.trim());
  const words = (match?.[3] ?? step).replace(/\s*\([^)]*\)\s*$/, "").trim();
  return { done: Number(match?.[1] ?? 0), total: Number(match?.[2] ?? 6), words: words || "Starting up" };
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const startOf = (job: Pick<PreviewJob, "startedAt" | "claimedAt" | "createdAt">) => job.startedAt ?? job.claimedAt ?? job.createdAt;

/**
 * The runner builds one site at a time, so on each runner only the newest claimed job can be running, and only
 * if the runner hasn't finished another job since it started. The rest never heard back (the runner restarted
 * mid-build) and are abandoned.
 */
export function splitActive<T extends Pick<PreviewJob, "runnerName" | "startedAt" | "claimedAt" | "createdAt">>(active: T[], lastFinished = new Map<string, Date>()): { current: T[]; abandoned: T[] } {
  const newest = new Map<string, T>();
  for (const job of active) {
    const seen = newest.get(job.runnerName);
    if (!seen || startOf(job) > startOf(seen)) newest.set(job.runnerName, job);
  }
  const current = [...newest.values()].filter((job) => !(lastFinished.get(job.runnerName) && lastFinished.get(job.runnerName)! > startOf(job)));
  return { current, abandoned: active.filter((job) => !current.includes(job)) };
}

export type Eta = { startedAt: Date; doneAt: Date; late: boolean };

/** When the current build should finish: its start plus the usual build length. */
export function etaFor(job: Pick<PreviewJob, "startedAt" | "claimedAt" | "createdAt">, minutes: number, now: number): Eta {
  const startedAt = startOf(job);
  const doneAt = new Date(startedAt.getTime() + minutes * 60_000);
  return { startedAt, doneAt, late: doneAt.getTime() < now };
}

/** When each queued job should start: after what's left of the current builds, one usual build length apart. */
export function queueStarts(count: number, currentDoneAt: Date | null, minutes: number, now: number): Date[] {
  const first = Math.max(now, currentDoneAt?.getTime() ?? now);
  return Array.from({ length: count }, (_, index) => new Date(first + index * minutes * 60_000));
}

/** Who asked for a job, as a sentence's subject; null when the admin queued it by itself. */
function requester(actor: string): string | null {
  if (actor === "bot:runner") return null;
  if (actor.startsWith("bot:")) return `The ${BOT_LABEL[actor.slice("bot:".length) as Bot] ?? "unknown"} bot`;
  if (actor.toLowerCase().startsWith("claude")) return "Claude";
  if (!actor.includes("@")) return actor;
  const name = founderName(actor);
  if (name !== actor) return name;
  const local = actor.split("@")[0].split(/[._-]/)[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/**
 * How a job came to be, as a sentence: "Claude queued this preview with notes for the builder." or "Queued again
 * automatically after a failed build." The note itself is the line's tooltip.
 */
export function requestSentence(job: Pick<PreviewJob, "requestedBy" | "kind" | "note">): string {
  const what = job.kind === "launch" ? "launch" : "preview";
  const who = requester(job.requestedBy);
  if (!who) return job.note ? "Queued again automatically after a failed build." : `Queued automatically as a new lead's ${what}.`;
  return `${who} queued this ${what}${job.note ? " with notes for the builder" : ""}.`;
}
