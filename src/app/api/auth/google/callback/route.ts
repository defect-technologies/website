import { NextResponse, type NextRequest } from "next/server";
import { record } from "@/server/activity";
import { completeAuthorization, googleClient } from "@/server/auth/google";
import { isFounder, startSession } from "@/server/auth/session";
import { env } from "@/server/env";
import { finishPortalGoogle, takePortalNext } from "@/server/portal/google";

function back(error: string, portal: boolean) {
  return NextResponse.redirect(new URL(portal ? `/portal/sign-in?error=google` : `/admin/sign-in?error=${error}`, env.siteUrl()));
}

export async function GET(request: NextRequest) {
  const portalNext = await takePortalNext();
  const google = googleClient("sign-in");
  if (!google) return back("not-configured", portalNext !== null);
  const identity = await completeAuthorization(google, request.nextUrl.searchParams).catch(() => null);
  if (!identity) return back("failed", portalNext !== null);
  if (portalNext !== null) return NextResponse.redirect(new URL(await finishPortalGoogle(identity.email, portalNext), env.siteUrl()));
  if (!isFounder(identity.email)) return back("not-a-founder", false);
  await startSession({ email: identity.email, name: identity.name });
  await record(identity.email, "signed in");
  return NextResponse.redirect(new URL("/admin", env.siteUrl()));
}
