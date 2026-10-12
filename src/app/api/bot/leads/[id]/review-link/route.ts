import { botRoute } from "@/server/bots/http";
import { reviewLink } from "@/server/bots/sites";

export const POST = botRoute(({ key, params }) => reviewLink(key, params.id));
