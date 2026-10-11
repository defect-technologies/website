import { closeFlagForBot, CloseBody } from "@/server/bots/flags";
import { botRoute, readBody } from "@/server/bots/http";

export const POST = botRoute(async ({ key, params, request }) => closeFlagForBot(key, params.id, await readBody(request, CloseBody)));
