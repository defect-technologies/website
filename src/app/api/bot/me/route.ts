import { BOT_JOB, BOT_LABEL, BOT_TRANSITIONS, type Bot } from "@/lib/bots";
import { botRoute } from "@/server/bots/http";

/** Who this key belongs to and what it may do. A good first call for a bot. */
export const GET = botRoute(async ({ key }) => {
  const bot = key.bot as Bot;
  return { bot, name: BOT_LABEL[bot], job: BOT_JOB[bot], stages: key.stages, moves: BOT_TRANSITIONS[bot] };
});
