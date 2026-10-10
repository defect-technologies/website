import { botRoute } from "@/server/bots/http";
import { billingLink } from "@/server/bots/sites";

export const POST = botRoute(({ key, params }) => billingLink(key, params.id));
