import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { emailPortalLink } from "@/server/portal/accounts";
import { currentCallerKey } from "@/server/portal/callerKey";
import { clientSite } from "@/server/sites/clientSites";

/**
 * Each client site's /edit posts here when the owner clicks "Email me a sign-in link". The link goes only
 * to the owner on file, signs them in to their portal and opens this site's editor.
 */
export async function POST(request: Request) {
  const slug = String((await request.formData()).get("site") ?? "").slice(0, 100);
  const site = await clientSite(slug);
  if (!site) return NextResponse.redirect(new URL("/portal/sign-in", env.siteUrl()), 303);
  const result = await emailPortalLink(site.ownerEmail, `/portal/edit/${site.slug}`, await currentCallerKey());
  return NextResponse.redirect(new URL(`/portal/sign-in?site=${encodeURIComponent(site.slug)}&result=${result}`, env.siteUrl()), 303);
}
