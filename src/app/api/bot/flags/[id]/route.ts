import { flagForBot } from "@/server/bots/flags";
import { botRoute } from "@/server/bots/http";

export const GET = botRoute(({ key, params }) => flagForBot(key, params.id));
