import { NextResponse, type NextRequest } from "next/server";
import { authorizationUrl, googleClient } from "@/server/auth/google";
import { requireFounder } from "@/server/auth/session";
import { env } from "@/server/env";

/** Sends a founder to Google to let the admin send from, and read, one Gmail inbox. */
export async function GET(request: NextRequest) {
  await requireFounder();
  const google = googleClient("mail");
  if (!google) return NextResponse.redirect(new URL("/admin/projects?mailbox=not-configured", env.siteUrl()));
  return NextResponse.redirect(await authorizationUrl("mail", google, request.nextUrl.searchParams.get("hint") ?? ""));
}
