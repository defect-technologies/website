import { runnerRoute } from "@/server/bots/http";
import { boardMemory } from "@/server/runner/boards";

/** GET /api/runner/boards: what the founders' design choices so far teach the next build. */
export const GET = runnerRoute(async () => boardMemory());
