import type { Stage } from "./stages";

/** The four Grok Bots from 02-system/oversight.md. */
export const BOTS = ["outreach", "onboarding", "client_care", "overseer"] as const;
export type Bot = (typeof BOTS)[number];

export const BOT_LABEL: Record<Bot, string> = {
  outreach: "Outreach",
  onboarding: "Onboarding",
  client_care: "Client care",
  overseer: "Overseer",
};

export const BOT_JOB: Record<Bot, string> = {
  outreach: "Answers prospects, sends checkout links and picks which leads get previews.",
  onboarding: "Takes a paying client from checkout to a live site, then hands them to Client care.",
  client_care: "Handles every live client's email: changes, questions, billing, reports and cancellations.",
  overseer: "Reviews the other bots, flags what's uncertain and sends the evening digest.",
};

/** The lead stages each bot owns. The admin's bot API refuses everything else. */
export const BOT_STAGES: Record<Bot, Stage[]> = {
  outreach: ["new", "preview_built", "sent", "clicked", "replied", "lost"],
  onboarding: ["paid"],
  client_care: ["live"],
  overseer: ["new", "preview_built", "sent", "clicked", "replied", "paid", "live", "lost", "opted_out"],
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
};

export function canMove(bot: Bot, from: Stage, to: Stage): boolean {
  return BOT_TRANSITIONS[bot][from]?.includes(to) ?? false;
}

export const FLAG_PRIORITIES = ["urgent", "review", "fyi"] as const;
export type FlagPriority = (typeof FLAG_PRIORITIES)[number];

export const FLAG_STATUSES = ["open", "answered", "approved", "reversed"] as const;
export type FlagStatus = (typeof FLAG_STATUSES)[number];

/** Grok Bot stores each bot's key as a Secret under this name. */
export const BOT_KEY_ENV = "DEFECT_BOT_KEY";
