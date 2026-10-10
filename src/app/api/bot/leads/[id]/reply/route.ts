import { botRoute, readBody } from "@/server/bots/http";
import { replyToLead, ReplyBody } from "@/server/bots/reply";

export const POST = botRoute(async ({ key, request, params }) => replyToLead(key, params.id, await readBody(request, ReplyBody)));
