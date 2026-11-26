import { NextResponse } from "next/server";
import { z } from "zod";
import { nextSearches } from "@/lib/research";
import { hasBearer } from "@/server/auth/bearer";
import { env } from "@/server/env";
import { markSearched, researchSettings } from "@/server/research";

const unauthorized = () => NextResponse.json({ error: "Wrong or missing ENGINE_TOKEN." }, { status: 401 });

/** GET /api/engine/research: tonight's searches for the lead finder, `{enabled, searches: [{niche, area}]}`. ENGINE_TOKEN. */
export async function GET(request: Request) {
  if (!hasBearer(request, env.engineToken())) return unauthorized();
  const current = await researchSettings();
  return NextResponse.json({ enabled: current.enabled, searches: current.enabled ? nextSearches(current) : [] });
}

const Ran = z.object({ searches: z.array(z.object({ niche: z.string().trim().min(1).max(120), area: z.string().trim().min(1).max(120) })).min(1).max(50) });

/** POST /api/engine/research `{searches: [{niche, area}]}`: the searches that ran, so the next night takes others. */
export async function POST(request: Request) {
  if (!hasBearer(request, env.engineToken())) return unauthorized();
  const ran = Ran.safeParse(await request.json().catch(() => null));
  if (!ran.success) return NextResponse.json({ error: z.prettifyError(ran.error) }, { status: 400 });
  await markSearched(ran.data.searches);
  return NextResponse.json({ ok: true });
}
