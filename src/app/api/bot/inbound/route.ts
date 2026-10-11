import { BotError, botRoute } from "@/server/bots/http";
import { InboundQuery, listInbound } from "@/server/bots/inbound";

export const GET = botRoute(async ({ key, request }) => {
  const parsed = InboundQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) throw new BotError(400, "status is open, accepted, declined, answered or closed; kind is unsorted, request, founder, bot or ignore.");
  return listInbound(key, parsed.data);
});
