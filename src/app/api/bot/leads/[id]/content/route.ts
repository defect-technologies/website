import { botRoute, readBody } from "@/server/bots/http";
import { changeContent, ContentBody, readContent } from "@/server/bots/sites";

export const GET = botRoute(({ key, params }) => readContent(key, params.id));
export const POST = botRoute(async ({ key, request, params }) => changeContent(key, params.id, await readBody(request, ContentBody)));
