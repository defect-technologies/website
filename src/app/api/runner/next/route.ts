import { runnerRoute } from "@/server/bots/http";
import { claimNext } from "@/server/runner/api";

export const GET = runnerRoute(async ({ key, request }) => claimNext(key, request));
