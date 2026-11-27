import { BOT_LABEL, BOTS, type Bot } from "./bots";

/**
 * How long each bot may go without checking in before the founders hear about it. Outreach, Onboarding and Client
 * care run every 10 to 30 minutes, the Overseer hourly, and the runner asks for work every few seconds. The admin
 * looks every 30 minutes, so an alert arrives within half an hour of these limits.
 */
export const LATE_AFTER_MINUTES: Record<Bot, number> = {
  outreach: 75,
  onboarding: 75,
  client_care: 75,
  overseer: 150,
  runner: 45,
};

export type BotWatchChanges = { stopped: Bot[]; recovered: Bot[] };

const isLate = (bot: Bot, lastCheckIn: Date, now: Date) => now.getTime() - lastCheckIn.getTime() > LATE_AFTER_MINUTES[bot] * 60_000;

/**
 * Which bots just stopped checking in and which just came back. A bot with no key is not set up, so it is never late.
 * A bot already reported stays quiet until it checks in again, so one outage sends one email.
 */
export function botWatchChanges(lastCheckIns: Map<Bot, Date>, alreadyReported: Set<Bot>, now: Date): BotWatchChanges {
  const changes: BotWatchChanges = { stopped: [], recovered: [] };
  for (const bot of BOTS) {
    const lastCheckIn = lastCheckIns.get(bot);
    if (!lastCheckIn) continue;
    const late = isLate(bot, lastCheckIn, now);
    if (late && !alreadyReported.has(bot)) changes.stopped.push(bot);
    if (!late && alreadyReported.has(bot)) changes.recovered.push(bot);
  }
  return changes;
}

const labels = (bots: Bot[]) => bots.map((bot) => BOT_LABEL[bot]).join(" and ");

export function stoppedEmail(bots: Bot[], lastCheckIns: Map<Bot, Date>, botsPage: string) {
  const lines = bots.map((bot) => `- ${BOT_LABEL[bot]}: last checked in ${lastCheckIns.get(bot)!.toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" })} Pacific`);
  const advice = "Open the bot in Grok Bot and check that its routine is on and its last run worked. For the preview runner, check Boris's machine.";
  return { subject: `${labels(bots)} stopped checking in`, body: [...lines, "", advice, "", `Bots page: ${botsPage}`].join("\n") };
}

export function recoveredEmail(bots: Bot[], botsPage: string) {
  return { subject: `${labels(bots)} checking in again`, body: [`${labels(bots)} checked in again. Nothing more to do.`, "", `Bots page: ${botsPage}`].join("\n") };
}
