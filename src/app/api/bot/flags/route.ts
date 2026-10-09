import { z } from "zod";
import { FLAG_STATUSES } from "@/lib/bots";
import { createFlag, FlagBody, listFlags } from "@/server/bots/flags";
import { BotError, botRoute, readBody } from "@/server/bots/http";

export const GET = botRoute(async ({ key, request }) => {
  const status = new URL(request.url).searchParams.get("status") ?? undefined;
  const parsed = z.enum(FLAG_STATUSES).optional().safeParse(status);
  if (!parsed.success) throw new BotError(400, `status must be one of ${FLAG_STATUSES.join(", ")}.`);
  return listFlags(key, parsed.data);
});

export const POST = botRoute(async ({ key, request }) => createFlag(key, await readBody(request, FlagBody)));
