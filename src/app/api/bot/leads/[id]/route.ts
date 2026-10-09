import { botRoute } from "@/server/bots/http";
import { leadDetail } from "@/server/bots/leads";

export const GET = botRoute(({ key, params }) => leadDetail(key, params.id));
