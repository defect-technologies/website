import { BotError, botRoute } from "@/server/bots/http";
import { LeadQuery, listLeads } from "@/server/bots/leads";

export const GET = botRoute(async ({ key, request }) => {
  const parsed = LeadQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) throw new BotError(400, "Use stage, email or q as query parameters.");
  return listLeads(key, parsed.data);
});
