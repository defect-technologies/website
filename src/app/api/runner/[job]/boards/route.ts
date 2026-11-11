import { readBody, runnerRoute } from "@/server/bots/http";
import { BoardsBody, reportBoards } from "@/server/runner/boards";

export const POST = runnerRoute(async ({ request, params }) => reportBoards(params.job, await readBody(request, BoardsBody)));
