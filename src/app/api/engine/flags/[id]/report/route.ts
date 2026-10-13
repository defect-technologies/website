import { NextResponse } from "next/server";
import { z } from "zod";
import { hasBearer } from "@/server/auth/bearer";
import { env } from "@/server/env";
import { reportClaudeFlag } from "@/server/flags/claudeQueue";

const ReportBody = z.object({
  outcome: z.enum(["fixed", "needs_founder"]),
  summary: z.string().trim().min(1).max(4000),
});

/** POST /api/engine/flags/:id/report: what the Claude session did. Fixed closes the flag; needs_founder hands it back. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasBearer(request, env.engineToken())) return NextResponse.json({ error: "Wrong or missing ENGINE_TOKEN." }, { status: 401 });
  const parsed = ReportBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const flag = await reportClaudeFlag((await params).id, parsed.data.outcome, parsed.data.summary);
  return flag ? NextResponse.json({ ok: true, status: flag.status }) : NextResponse.json({ error: "No such flag." }, { status: 404 });
}
