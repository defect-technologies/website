import { runnerRoute } from "@/server/bots/http";
import { spotCheckNotes } from "@/server/spotChecks";

const MAX = 200;

/** GET /api/runner/spot-checks?since=<ISO date>&limit=: founders' ratings and notes on past previews, newest first. Read-only. */
export const GET = runnerRoute(async ({ request }) => {
  const search = new URL(request.url).searchParams;
  const since = search.get("since") ? new Date(search.get("since")!) : null;
  const limit = Math.min(MAX, Math.max(1, Number(search.get("limit")) || 50));
  const checks = await spotCheckNotes(since && !Number.isNaN(since.getTime()) ? since : null, limit);
  return { checks };
});
