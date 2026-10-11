import type { Bot } from "@/lib/bots";
import { botRoute } from "@/server/bots/http";
import { botInstructions, noteLoaded } from "@/server/bots/instructions";

/** This bot's standing instructions as merged on main. A bot calls it at the start of every run and reloads when the version changes. */
export const GET = botRoute(async ({ key }) => {
  const current = await botInstructions(key.bot as Bot);
  await noteLoaded(current.bot, current.version);
  return current;
});
