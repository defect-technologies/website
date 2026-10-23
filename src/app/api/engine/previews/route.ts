import { NextResponse } from "next/server";
import { z } from "zod";
import { hasBearer } from "@/server/auth/bearer";
import { env } from "@/server/env";
import { recordBuiltPreview } from "@/server/leads/previewReports";

const PreviewReport = z.object({
  slug: z.string().min(1).max(80),
  preview_url: z.url({ protocol: /^https$/ }),
  problem: z.string().max(400).default(""),
  promote: z.boolean().default(false),
});

/**
 * The preview builder calls this after `build_preview.sh --deploy`, so the
 * lead shows up in the outreach queue with its preview and problem line.
 */
export async function POST(request: Request) {
  if (!hasBearer(request, env.engineToken())) return NextResponse.json({ error: "Wrong or missing ENGINE_TOKEN." }, { status: 401 });
  const parsed = PreviewReport.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const { slug, preview_url, problem, promote } = parsed.data;
  const recorded = await recordBuiltPreview({ slug, previewUrl: preview_url, problem, promote, actor: "preview builder" });
  if (!recorded.found) return NextResponse.json({ error: `No lead has the slug ${slug}. Import leads.csv first.` }, { status: 404 });
  return NextResponse.json({ ok: true, admin: new URL(`/admin/sites/${recorded.businessId}`, env.siteUrl()).toString() });
}
