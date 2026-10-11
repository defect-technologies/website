import { NextResponse } from "next/server";
import { enterUrl } from "@/server/editor/signInLinks";
import { env } from "@/server/env";
import { currentOwner } from "@/server/portal/session";
import { sitesForOwner } from "@/server/sites/clientSites";

/** Opens the owner's editor on their own site, already signed in. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const owner = await currentOwner();
  if (!owner) return NextResponse.redirect(new URL(`/portal/sign-in?site=${encodeURIComponent(slug)}`, env.siteUrl()));
  const site = (await sitesForOwner(owner.email)).find((candidate) => candidate.slug === slug);
  if (!site) return NextResponse.redirect(new URL("/portal", env.siteUrl()));
  return NextResponse.redirect(await enterUrl(site, owner.email));
}
