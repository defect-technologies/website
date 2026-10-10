import { botRoute } from "@/server/bots/http";
import { requestLaunch } from "@/server/bots/sites";

export const POST = botRoute(({ key, params }) => requestLaunch(key, params.id));
