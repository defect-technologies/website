import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { asClause } from "@/lib/emailTemplate";
import { record } from "@/server/activity";
import { hasBearer } from "@/server/auth/bearer";
import { db } from "@/server/db/client";
import { businesses } from "@/server/db/schema";
import { env } from "@/server/env";
import { advanceStage, updateBusiness } from "@/server/leads/businesses";
import { maybePickForSpotCheck } from "@/server/spotChecks";

const PreviewReport = z.object({
  slug: z.string().min(1).max(80),
  preview_url: z.url({ protocol: /^https$/ }),
  problem: z.string().max(400).default(""),
  promote: z.boolean().default(false),
});

/** Stages at which the owner has been sent their preview. */
const OWNER_HAS_SEEN = ["sent", "clicked", "replied", "paid", "live"];

/**
 * The preview builder calls this after `build_preview.sh --deploy`, so the
 * lead shows up in the outreach queue with its preview and problem line.
 */
export async function POST(request: Request) {
  if (!hasBearer(request, env.engineToken())) return NextResponse.json({ error: "Wrong or missing ENGINE_TOKEN." }, { status: 401 });
  const parsed = PreviewReport.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const { slug, preview_url, problem, promote } = parsed.data;
  const [business] = await (await db()).select().from(businesses).where(eq(businesses.slug, slug));
  if (!business) return NextResponse.json({ error: `No lead has the slug ${slug}. Import leads.csv first.` }, { status: 404 });
  // An owner who has been sent a preview keeps it until a founder shows them the new one (the runner's report
  // raises that question); `promote` moves it outright.
  const ownerHasOne = OWNER_HAS_SEEN.includes(business.stage) && Boolean(business.previewUrl);
  await updateBusiness(business.id, {
    ...(ownerHasOne && !promote ? {} : { previewUrl: preview_url }),
    previewBuiltAt: new Date(),
    emailProblem: problem ? asClause(problem) : business.emailProblem,
  });
  await advanceStage(business.id, "preview_built");
  await record("preview builder", "preview built", { businessId: business.id, detail: preview_url });
  await maybePickForSpotCheck(business, preview_url, null, "preview builder");
  return NextResponse.json({ ok: true, admin: new URL(`/admin/sites/${business.id}`, env.siteUrl()).toString() });
}
