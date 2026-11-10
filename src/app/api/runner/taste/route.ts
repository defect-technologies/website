import { runnerRoute } from "@/server/bots/http";
import { tasteForRunner } from "@/server/review/taste";

/** GET /api/runner/taste: the founders' active taste lessons, and the markdown the builder saves as lead/taste.md. */
export const GET = runnerRoute(async () => tasteForRunner());
