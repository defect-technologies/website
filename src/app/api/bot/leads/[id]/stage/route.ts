import { botRoute, readBody } from "@/server/bots/http";
import { moveStage, StageBody } from "@/server/bots/leads";

export const POST = botRoute(async ({ key, request, params }) => moveStage(key, params.id, await readBody(request, StageBody)));
