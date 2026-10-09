import { readBody, runnerRoute } from "@/server/bots/http";
import { ProgressBody, reportProgress } from "@/server/runner/api";

export const POST = runnerRoute(async ({ request, params }) => reportProgress(params.job, await readBody(request, ProgressBody)));
