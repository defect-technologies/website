import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { billingPortalLink } from "@/server/integrations/stripe";
import { currentOwner } from "@/server/portal/session";
import { sitesForOwner } from "@/server/sites/clientSites";

/** Opens Stripe's billing page for the owner's plan, coming back to the portal afterwards. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const owner = await currentOwner();
  if (!owner) return NextResponse.redirect(new URL("/portal/sign-in", env.siteUrl()));
  const site = (await sitesForOwner(owner.email)).find((candidate) => candidate.slug === slug);
  if (!site?.stripeCustomerId) return NextResponse.redirect(new URL("/portal?billing=missing", env.siteUrl()));
  try {
    return NextResponse.redirect(await billingPortalLink(site.stripeCustomerId, new URL("/portal", env.siteUrl()).toString()));
  } catch (error) {
    console.error(`[portal] Billing link for ${slug} failed`, error);
    return NextResponse.redirect(new URL("/portal?billing=failed", env.siteUrl()));
  }
}
