import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { emailPortalLink } from "@/server/portal/accounts";
import { clientSite } from "@/server/sites/clientSites";

/**
 * Each client site's /edit posts here when the owner clicks "Email me a sign-in link". The link goes only
 * to the owner on file, signs them in to their portal and opens this site's editor.
 */
export async function POST(request: Request) {
  const slug = String((await request.formData()).get("site") ?? "").slice(0, 100);
  const site = await clientSite(slug);
  if (!site) return NextResponse.redirect(new URL("/portal/sign-in", env.siteUrl()), 303);
  await emailPortalLink(site.ownerEmail, `/portal/edit/${site.slug}`);
  return NextResponse.redirect(new URL(`/portal/sign-in?site=${encodeURIComponent(site.slug)}&result=sent`, env.siteUrl()), 303);
}
