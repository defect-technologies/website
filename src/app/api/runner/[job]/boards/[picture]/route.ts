import { runnerRoute } from "@/server/bots/http";
import { uploadBoardPicture } from "@/server/runner/boards";

export const PUT = runnerRoute(async ({ request, params }) => uploadBoardPicture(params.job, params.picture, request));
