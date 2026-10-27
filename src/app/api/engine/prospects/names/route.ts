import { NextResponse } from "next/server";
import { z } from "zod";
import { record } from "@/server/activity";
import { hasBearer } from "@/server/auth/bearer";
import { env } from "@/server/env";
import { ProspectRenames, renameProspects } from "@/server/prospects";

/**
 * POST /api/engine/prospects/names {names: [{id, businessName}]}: corrects audited businesses' names, and their leads
 * while still new. ENGINE_TOKEN. Each rename is in the activity log.
 */
export async function POST(request: Request) {
  if (!hasBearer(request, env.engineToken())) return NextResponse.json({ error: "Wrong or missing ENGINE_TOKEN." }, { status: 401 });
  const parsed = ProspectRenames.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const result = await renameProspects(parsed.data.names);
  for (const entry of result.renamed) {
    await record("bot:lead-finder", "corrected a business's name", { businessId: entry.businessId, detail: `${entry.from || "(none)"} → ${entry.to}` });
  }
  return NextResponse.json({ ok: true, prospects: result.prospects, leads: result.leads });
}
