import { runnerRoute } from "@/server/bots/http";
import { uploadRepairPicture } from "@/server/runner/repairs";

export const PUT = runnerRoute(async ({ request, params }) => uploadRepairPicture(params.job, params.picture, request));
