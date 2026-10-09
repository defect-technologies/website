import { readBody, runnerRoute } from "@/server/bots/http";
import { DoneBody, reportDone } from "@/server/runner/api";

export const POST = runnerRoute(async ({ request, params }) => reportDone(params.job, await readBody(request, DoneBody)));
