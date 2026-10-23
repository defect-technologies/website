import "server-only";
import { eq } from "drizzle-orm";
import { asClause } from "@/lib/emailTemplate";
import { record } from "@/server/activity";
import { db } from "@/server/db/client";
import { businesses, type Business } from "@/server/db/schema";
import { advanceStage, updateBusiness } from "@/server/leads/businesses";
import { maybePickForSpotCheck } from "@/server/spotChecks";

/** Stages at which the owner has been sent their preview. */
const OWNER_HAS_SEEN = ["sent", "clicked", "replied", "paid", "live"];

/** Returns why a preview can't become the lead's link, or null when it can. */
export type PreviewGuard = (business: Business, previewUrl: string) => Promise<string | null>;

export type BuiltPreview = { slug: string; previewUrl: string; problem?: string; promote?: boolean; actor: string; guard?: PreviewGuard };

export type PreviewRecorded =
  | { found: false }
  | { found: true; businessId: string; linkMoved: boolean; skipped?: string };

/**
 * A lead's preview is deployed. An owner who has been sent a preview keeps it until a founder shows them the new
 * one; `promote` moves it outright.
 */
export async function recordBuiltPreview({ slug, previewUrl, problem = "", promote = false, actor, guard }: BuiltPreview): Promise<PreviewRecorded> {
  const [business] = await (await db()).select().from(businesses).where(eq(businesses.slug, slug));
  if (!business) return { found: false };
  const skipped = guard ? await guard(business, previewUrl) : null;
  if (skipped) {
    await record(actor, "skipped a preview", { businessId: business.id, detail: `${previewUrl}: ${skipped}` });
    return { found: true, businessId: business.id, linkMoved: false, skipped };
  }
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
