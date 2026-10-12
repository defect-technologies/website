import { botRoute } from "@/server/bots/http";
import { publishChanges } from "@/server/bots/sites";

export const POST = botRoute(({ key, params }) => publishChanges(key, params.id));
