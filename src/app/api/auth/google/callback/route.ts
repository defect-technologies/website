import { NextResponse, type NextRequest } from "next/server";
import { record } from "@/server/activity";
import { completeAuthorization, googleClient } from "@/server/auth/google";
import { DESIGNER_HOME, startDesignerSession } from "@/server/auth/designerSession";
import { isFounder, startSession } from "@/server/auth/session";
import { activeDesignerByEmail } from "@/server/designers/people";
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
  if (isFounder(identity.email)) return signInFounder(identity);
  const designer = await activeDesignerByEmail(identity.email);
  if (!designer) return back("not-allowed", false);
  await startDesignerSession(designer);
  await record(designer.email, "signed in as a designer");
  return NextResponse.redirect(new URL(DESIGNER_HOME, env.siteUrl()));
}

async function signInFounder(identity: { email: string; name: string }) {
  await startSession({ email: identity.email, name: identity.name });
  await record(identity.email, "signed in");
  return NextResponse.redirect(new URL("/admin", env.siteUrl()));
}
