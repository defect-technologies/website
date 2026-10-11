import { botRoute } from "@/server/bots/http";
import { inboundForBot } from "@/server/bots/inbound";

export const GET = botRoute(async ({ key, params }) => inboundForBot(key, params.id));
