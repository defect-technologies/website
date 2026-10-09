import { BOT_JOB, BOT_LABEL, BOT_TRANSITIONS, OUTREACH_PREVIEW_JOB, type Bot } from "@/lib/bots";
import { botRoute } from "@/server/bots/http";
import { runnerSettings } from "@/server/runner/settings";

async function jobFor(bot: Bot): Promise<string> {
  if (bot !== "outreach") return BOT_JOB[bot];
  return (await runnerSettings()).outreachPicksPreviews ? OUTREACH_PREVIEW_JOB : BOT_JOB.outreach;
}

/** Who this key belongs to and what it may do. A good first call for a bot. */
export const GET = botRoute(async ({ key }) => {
  const bot = key.bot as Bot;
  return { bot, name: BOT_LABEL[bot], job: await jobFor(bot), stages: key.stages, moves: BOT_TRANSITIONS[bot] };
});
