import { runnerRoute } from "@/server/bots/http";
import { criticSettings } from "@/server/review/criticSettings";

/** GET /api/runner/critics: whether the build runs the critics, for how long, and which kinds of note it applies without a founder. */
export const GET = runnerRoute(async () => criticSettings());
