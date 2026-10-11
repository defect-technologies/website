import { NextResponse } from "next/server";
import { requestLinkForSite } from "@/server/editor/signInLinks";
import { env } from "@/server/env";

/**
 * Each client site's /edit posts here when the owner clicks "Email me a sign-in link".
 * The link goes only to the owner on file, so the form needs no address and reveals none.
 */
export async function POST(request: Request) {
  const slug = String((await request.formData()).get("site") ?? "").slice(0, 100);
  const result = await requestLinkForSite(slug);
  const destination = new URL("/edit/sign-in", env.siteUrl());
  if (result.status !== "unknown") {
    destination.searchParams.set("site", slug);
    destination.searchParams.set("result", result.status);
  }
  return NextResponse.redirect(destination, 303);
}
