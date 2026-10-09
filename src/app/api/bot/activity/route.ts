import { activitySince } from "@/server/bots/flags";
import { BotError, botRoute } from "@/server/bots/http";

const DAY_MS = 86_400_000;

export const GET = botRoute(async ({ key, request }) => {
  const raw = new URL(request.url).searchParams.get("since");
  const since = raw ? new Date(raw) : new Date(Date.now() - DAY_MS);
  if (Number.isNaN(since.getTime())) throw new BotError(400, "since must be an ISO date, like 2026-10-09T18:00:00Z.");
  return activitySince(key, since);
});
