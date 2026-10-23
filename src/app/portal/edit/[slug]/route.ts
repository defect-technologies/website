import { NextResponse } from "next/server";
import { enterUrl } from "@/server/editor/signInLinks";
import { env } from "@/server/env";
import { portalSite } from "@/server/portal/context";
import { currentPortalUser } from "@/server/portal/session";

/** Opens the editor on a site the signed-in owner or editor may edit, already signed in as them. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await currentPortalUser();
  if (!user) return NextResponse.redirect(new URL(`/portal/sign-in?site=${encodeURIComponent(slug)}`, env.siteUrl()));
  const site = await portalSite(user, slug);
  if (!site) return NextResponse.redirect(new URL("/portal", env.siteUrl()));
  return NextResponse.redirect(await enterUrl(site, user.email));
}
