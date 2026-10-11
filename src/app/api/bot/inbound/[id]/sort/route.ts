import { botRoute, readBody } from "@/server/bots/http";
import { SortBody, sortInbound } from "@/server/bots/inbound";

export const POST = botRoute(async ({ key, request, params }) => sortInbound(key, params.id, await readBody(request, SortBody)));
