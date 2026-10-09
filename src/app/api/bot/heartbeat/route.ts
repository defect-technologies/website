import { z } from "zod";
import { botRoute, readBody } from "@/server/bots/http";
import { recordHeartbeat } from "@/server/bots/keys";

const Heartbeat = z.object({ routine: z.string().trim().min(1).max(100) });

/** Called at the end of every routine run, even an idle one, so a stalled bot shows in the admin. */
export const POST = botRoute(async ({ key, request }) => {
  const { routine } = await readBody(request, Heartbeat);
  await recordHeartbeat(key.id, routine);
  return { ok: true };
});
