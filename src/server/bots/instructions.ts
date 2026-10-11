import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Bot } from "@/lib/bots";
import { record } from "../activity";
import { db } from "../db/client";
import { activity } from "../db/schema";
import { env } from "../env";
import { BotError } from "./http";

type SpecBot = Exclude<Bot, "runner">;

const SPEC_REPO = "defect-technologies/defect-tech";

/** Each Grok Bot's spec in the defect-tech repo. The runner has none: it's a script, not a bot. */
const SPEC_PATH: Record<SpecBot, string> = {
  outreach: "02-system/bots/outreach.md",
  onboarding: "02-system/bots/onboarding.md",
  client_care: "02-system/bots/client-care.md",
  overseer: "02-system/bots/overseer.md",
};

const CACHE_MS = 60_000;
const LOADED = "loaded new instructions";

export type BotInstructions = { bot: SpecBot; version: string; instructions: string; source: string };

const cache = new Map<SpecBot, { at: number; value: BotInstructions }>();

const hasSpec = (bot: Bot): bot is SpecBot => bot in SPEC_PATH;

/** The standing instructions in a spec: the fenced block under "**Description:**", which is what a bot keeps. */
export function instructionsFrom(spec: string): string | null {
  const match = /\*\*Description:\*\*\s*\n+```[^\n]*\n([\s\S]*?)\n```/.exec(spec);
  return match ? match[1].trim() : null;
}

/** Changes only when the instructions do, so an edit elsewhere in the spec doesn't make every bot reload. */
const versionOf = (instructions: string) => createHash("sha256").update(instructions).digest("hex").slice(0, 12);

async function fetchSpec(path: string): Promise<string> {
  const token = env.githubReadToken();
  if (!token) throw new BotError(503, "The admin can't read your instructions yet (GITHUB_READ_TOKEN isn't set). Keep using your saved copy.");
  const response = await fetch(`https://api.github.com/repos/${SPEC_REPO}/contents/${path}?ref=main`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" },
    cache: "no-store",
  });
  if (!response.ok) throw new BotError(502, `GitHub answered ${response.status} for your instructions. Keep using your saved copy.`);
  return response.text();
}

/** A bot's current standing instructions from main, cached for a minute. */
export async function botInstructions(bot: Bot): Promise<BotInstructions> {
  if (!hasSpec(bot)) throw new BotError(404, "Only the four Grok Bots have instructions here.");
  const cached = cache.get(bot);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const instructions = instructionsFrom(await fetchSpec(SPEC_PATH[bot]));
  if (!instructions) throw new BotError(502, `${SPEC_PATH[bot]} has no Description block. Keep using your saved copy, and flag it.`);
  const value = { bot, version: versionOf(instructions), instructions, source: `${SPEC_REPO}/${SPEC_PATH[bot]}` };
  cache.set(bot, { at: Date.now(), value });
  return value;
}

/** The instructions version a bot last fetched, from the activity log. Empty when it never has. */
export async function loadedVersion(bot: Bot): Promise<string> {
  const [row] = await (await db())
    .select({ detail: activity.detail })
    .from(activity)
    .where(and(eq(activity.actor, `bot:${bot}`), eq(activity.action, LOADED)))
    .orderBy(desc(activity.at))
    .limit(1);
  return row?.detail ?? "";
}

/** Logs a version the first time a bot fetches it, so the Bots page can tell who's behind. */
export async function noteLoaded(bot: Bot, version: string) {
  if ((await loadedVersion(bot)) !== version) await record(`bot:${bot}`, LOADED, { detail: version });
}

export type InstructionsStatus =
  | { kind: "unconfigured" }
  | { kind: "unavailable"; reason: string }
  | { kind: "never" | "current" | "behind"; latest: string; loaded: string };

/** Whether a bot is running the instructions on main, for the Bots page. */
export async function instructionsStatus(bot: Bot): Promise<InstructionsStatus> {
  if (!env.githubReadToken()) return { kind: "unconfigured" };
  const [latest, loaded] = await Promise.all([botInstructions(bot).catch(() => null), loadedVersion(bot)]);
  if (!latest) return { kind: "unavailable", reason: "GitHub didn't return these instructions. Check the token, and that the spec still has its Description block." };
  const kind = !loaded ? "never" : loaded === latest.version ? "current" : "behind";
  return { kind, latest: latest.version, loaded };
}
