import { botRoute, readBody } from "@/server/bots/http";
import { replyToInbound } from "@/server/bots/inbound";
import { ReplyBody } from "@/server/bots/reply";

export const POST = botRoute(async ({ key, request, params }) => replyToInbound(key, params.id, await readBody(request, ReplyBody)));
