import { NextResponse } from "next/server";
import { hasBearer } from "@/server/auth/bearer";
import { env } from "@/server/env";
import { claimClaudeFlag } from "@/server/flags/claudeQueue";

/** POST /api/engine/flags/:id/claim: a Claude session starts on this flag. 409 when someone else already has. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasBearer(request, env.engineToken())) return NextResponse.json({ error: "Wrong or missing ENGINE_TOKEN." }, { status: 401 });
  const claimed = await claimClaudeFlag((await params).id);
  return claimed ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Already claimed, resolved or gone." }, { status: 409 });
}
