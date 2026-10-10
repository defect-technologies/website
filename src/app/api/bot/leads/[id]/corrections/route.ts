import { botRoute, readBody } from "@/server/bots/http";
import { CorrectionsBody, requestCorrections } from "@/server/bots/sites";

export const POST = botRoute(async ({ key, request, params }) => requestCorrections(key, params.id, await readBody(request, CorrectionsBody)));
