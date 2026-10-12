import { botRoute } from "@/server/bots/http";
import { discardChanges } from "@/server/bots/sites";

export const POST = botRoute(({ key, params }) => discardChanges(key, params.id));
