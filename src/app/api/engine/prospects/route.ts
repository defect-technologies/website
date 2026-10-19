import { NextResponse } from "next/server";
import { z } from "zod";
import { hasBearer } from "@/server/auth/bearer";
import { env } from "@/server/env";
import { ProspectBatch, ProspectInput, prospectWebsites, upsertProspects } from "@/server/prospects";

/**
 * The lead finder posts every business it audited here, up to 200 at a time, whether or
 * not it became a lead. Businesses already stored (by place ID, else website domain) are
 * refreshed. Rows that don't parse are skipped and counted, so one bad row never loses a batch.
 */
export async function POST(request: Request) {
  if (!hasBearer(request, env.engineToken())) return NextResponse.json({ error: "Wrong or missing ENGINE_TOKEN." }, { status: 401 });
  const batch = ProspectBatch.safeParse(await request.json().catch(() => null));
  if (!batch.success) return NextResponse.json({ error: z.prettifyError(batch.error) }, { status: 400 });
  const parsed = batch.data.prospects.map((entry) => ProspectInput.safeParse(entry));
  const valid = parsed.flatMap((result) => (result.success ? [result.data] : []));
  const { saved, skipped, linked } = await upsertProspects(valid);
  return NextResponse.json({ ok: true, saved, skipped: skipped + parsed.length - valid.length, linked });
}

/**
 * GET /api/engine/prospects?offset=0&limit=500: the prospects with a website, newest first, for founders' tools
 * and Claude (e.g. to look for sites made with AI). ENGINE_TOKEN.
 */
export async function GET(request: Request) {
  if (!hasBearer(request, env.engineToken())) return NextResponse.json({ error: "Wrong or missing ENGINE_TOKEN." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const limit = Math.min(1000, Math.max(1, Number(params.get("limit")) || 500));
  return NextResponse.json({ prospects: await prospectWebsites(offset, limit) });
}
