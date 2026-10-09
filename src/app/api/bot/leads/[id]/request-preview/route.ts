import { botRoute, readBody } from "@/server/bots/http";
import { botRequestPreview, RequestBody } from "@/server/runner/api";

export const POST = botRoute(async ({ key, request, params }) => botRequestPreview(key, params.id, await readBody(request, RequestBody)));
