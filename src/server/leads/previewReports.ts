import "server-only";
import { eq } from "drizzle-orm";
import { asClause } from "@/lib/emailTemplate";
import { record } from "@/server/activity";
import { db } from "@/server/db/client";
import { businesses } from "@/server/db/schema";
import { advanceStage, updateBusiness } from "@/server/leads/businesses";
import { maybePickForSpotCheck } from "@/server/spotChecks";

/** Stages at which the owner has been sent their preview. */
const OWNER_HAS_SEEN = ["sent", "clicked", "replied", "paid", "live"];

export type BuiltPreview = { slug: string; previewUrl: string; problem?: string; promote?: boolean; actor: string };

export type PreviewRecorded = { found: false } | { found: true; businessId: string; linkMoved: boolean };

/**
 * A lead's preview is deployed. An owner who has been sent a preview keeps it until a founder shows them the new
 * one; `promote` moves it outright.
 */
export async function recordBuiltPreview({ slug, previewUrl, problem = "", promote = false, actor }: BuiltPreview): Promise<PreviewRecorded> {
  const [business] = await (await db()).select().from(businesses).where(eq(businesses.slug, slug));
  if (!business) return { found: false };
  const ownerHasOne = OWNER_HAS_SEEN.includes(business.stage) && Boolean(business.previewUrl);
  const linkMoved = !ownerHasOne || promote;
  await updateBusiness(business.id, {
    ...(linkMoved ? { previewUrl } : {}),
    previewBuiltAt: new Date(),
    emailProblem: problem ? asClause(problem) : business.emailProblem,
  });
  await advanceStage(business.id, "preview_built");
  await record(actor, "preview built", { businessId: business.id, detail: previewUrl });
  await maybePickForSpotCheck(business, previewUrl, null, actor);
  return { found: true, businessId: business.id, linkMoved };
}
