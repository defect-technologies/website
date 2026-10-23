import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { billingPortalLink } from "@/server/integrations/stripe";
import { isOwnerOf, portalSite } from "@/server/portal/context";
import { currentPortalUser } from "@/server/portal/session";

const billingPage = (slug: string, problem?: string) => {
  const url = new URL("/portal/billing", env.siteUrl());
  url.searchParams.set("site", slug);
  if (problem) url.searchParams.set("problem", problem);
  return url;
};

/** Opens Stripe's billing page for the owner's plan, coming back to the portal's Billing tab afterwards. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await currentPortalUser();
  if (!user) return NextResponse.redirect(new URL("/portal/sign-in", env.siteUrl()));
  const site = await portalSite(user, slug);
  if (site && !isOwnerOf(site)) return NextResponse.redirect(billingPage(slug));
  if (!site?.stripeCustomerId) return NextResponse.redirect(billingPage(slug, "missing"));
  try {
    return NextResponse.redirect(await billingPortalLink(site.stripeCustomerId, billingPage(slug).toString()));
  } catch (error) {
    console.error(`[portal] Billing link for ${slug} failed`, error);
    return NextResponse.redirect(billingPage(slug, "failed"));
  }
}
