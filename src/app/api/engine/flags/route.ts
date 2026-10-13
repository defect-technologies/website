import { NextResponse } from "next/server";
import { hasBearer } from "@/server/auth/bearer";
import { env } from "@/server/env";
import { waitingClaudeFlags } from "@/server/flags/claudeQueue";

/** GET /api/engine/flags: open flags assigned to Claude that no session has claimed, with their fix prompts. */
export async function GET(request: Request) {
  if (!hasBearer(request, env.engineToken())) return NextResponse.json({ error: "Wrong or missing ENGINE_TOKEN." }, { status: 401 });
  return NextResponse.json({ flags: await waitingClaudeFlags() });
}
