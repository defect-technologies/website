import { NextResponse, type NextRequest } from "next/server";
import { record } from "@/server/activity";
import { completeAuthorization, googleClient } from "@/server/auth/google";
import { isFounder, startSession } from "@/server/auth/session";
import { env } from "@/server/env";

function back(error: string) {
  return NextResponse.redirect(new URL(`/admin/sign-in?error=${error}`, env.siteUrl()));
}

export async function GET(request: NextRequest) {
  const google = googleClient("sign-in");
  if (!google) return back("not-configured");
  const identity = await completeAuthorization(google, request.nextUrl.searchParams).catch(() => null);
  if (!identity) return back("failed");
  if (!isFounder(identity.email)) return back("not-a-founder");
  await startSession({ email: identity.email, name: identity.name });
  await record(identity.email, "signed in");
  return NextResponse.redirect(new URL("/admin", env.siteUrl()));
}
