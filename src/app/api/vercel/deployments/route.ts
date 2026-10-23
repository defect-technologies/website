import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { isSignedByVercel, leadPreviewFrom } from "@/server/integrations/vercelDeployHook";
import { recordBuiltPreview } from "@/server/leads/previewReports";

/**
 * Vercel calls this when a deployment in the previews project succeeds. A deploy tagged `--meta lead=<slug>`
 * becomes that lead's preview link, the same as a report from the preview builder.
 */
export async function POST(request: Request) {
  const { webhookSecret, previewProject } = env.vercel();
  const rawBody = await request.text();
  if (!isSignedByVercel(rawBody, request.headers.get("x-vercel-signature"), webhookSecret)) {
    return NextResponse.json({ error: "Wrong or missing signature." }, { status: 401 });
  }
  const preview = leadPreviewFrom(JSON.parse(rawBody), previewProject);
  if (!preview) return NextResponse.json({ ok: true, ignored: true });
  const recorded = await recordBuiltPreview({ ...preview, actor: "Vercel" });
  return NextResponse.json({ ok: true, ...recorded });
}
