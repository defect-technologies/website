import { RUNNER_KEY_ENV } from "./previewJobs";
import type { Stage } from "./stages";

/**
 * The four Grok Bots from 02-system/oversight.md, plus the preview runner on the
 * always-on Ubuntu machine (02-system/preview-runner.md), which owns no leads and
 * only talks to /api/runner.
 */
export const BOTS = ["outreach", "onboarding", "client_care", "overseer", "runner"] as const;
export type Bot = (typeof BOTS)[number];

export const BOT_LABEL: Record<Bot, string> = {
  outreach: "Outreach",
  onboarding: "Onboarding",
  client_care: "Client care",
  overseer: "Overseer",
  runner: "Preview runner",
};

export const BOT_JOB: Record<Bot, string> = {
  outreach: "Answers prospects and sends interested owners their checkout links.",
  onboarding: "Takes a paying client from checkout to a live site, then hands them to Client care.",
  client_care: "Handles every live client's email: changes, questions, billing, reports and cancellations.",
  overseer: "Reviews the other bots, flags what's uncertain and sends the evening digest.",
  runner: "Builds previews for leads in the build queue on the always-on machine, then reports the link and its usage.",
};

/** Said to the Outreach bot only once a founder lets it request previews. */
export const OUTREACH_PREVIEW_JOB = "Answers prospects, sends interested owners their checkout links, and requests previews for leads worth one.";

/** The lead stages each bot owns. The admin's bot API refuses everything else. */
export const BOT_STAGES: Record<Bot, Stage[]> = {
  outreach: ["new", "preview_built", "sent", "clicked", "replied", "lost"],
  onboarding: ["paid"],
  client_care: ["live"],
  overseer: ["new", "preview_built", "sent", "clicked", "replied", "paid", "live", "lost", "opted_out"],
  runner: [],
};

/** Stage moves each bot may make. Paid comes from Stripe, never from a bot. */
export const BOT_TRANSITIONS: Record<Bot, Partial<Record<Stage, Stage[]>>> = {
  outreach: {
    new: ["lost"],
    preview_built: ["lost", "opted_out"],
    sent: ["lost", "opted_out"],
    clicked: ["lost", "opted_out"],
    replied: ["lost", "opted_out"],
  },
  onboarding: { paid: ["live"] },
  client_care: { live: ["lost"] },
  overseer: {},
  runner: {},
};

export function canMove(bot: Bot, from: Stage, to: Stage): boolean {
  return BOT_TRANSITIONS[bot][from]?.includes(to) ?? false;
}

export const FLAG_PRIORITIES = ["urgent", "review", "fyi"] as const;
export type FlagPriority = (typeof FLAG_PRIORITIES)[number];

export const FLAG_STATUSES = ["open", "answered", "approved", "reversed"] as const;
export type FlagStatus = (typeof FLAG_STATUSES)[number];

/**
 * Each bot's key gets its own Secret name: Grok Bot secrets are usable by every
 * Bot on the shared computer, so a shared name would let bots overwrite each other's.
 */
export const BOT_KEY_ENV: Record<Exclude<Bot, "runner">, string> = {
  outreach: "DEFECT_OUTREACH_KEY",
  onboarding: "DEFECT_ONBOARDING_KEY",
  client_care: "DEFECT_CLIENT_CARE_KEY",
  overseer: "DEFECT_OVERSEER_KEY",
};

/** Where each key goes once it's created: a Grok Bot Secret, or the runner machine's env file. */
export function keyHome(bot: Bot): { env: string; where: string } {
  if (bot === "runner") return { env: RUNNER_KEY_ENV, where: "/etc/defect-runner.env on the runner machine" };
  return { env: BOT_KEY_ENV[bot], where: "the bot's Secrets in Grok Bot" };
}

/** "bot:client_care" reads as "Client care bot", a founder's address as their name; scripts keep their own names. */
export function actorLabel(actor: string): string {
  if (actor.startsWith("bot:")) {
    const bot = actor.slice("bot:".length) as Bot;
    if (bot === "runner") return BOT_LABEL.runner;
    return BOT_LABEL[bot] ? `${BOT_LABEL[bot]} bot` : actor;
  }
  return actor.includes("@") ? actor.split("@")[0] : actor;
}
