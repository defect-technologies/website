import { NextResponse } from "next/server";
import { authorizationUrl, googleClient } from "@/server/auth/google";
import { env } from "@/server/env";

export async function GET() {
  const google = googleClient("sign-in");
  if (!google) return NextResponse.redirect(new URL("/admin/sign-in?error=not-configured", env.siteUrl()));
  return NextResponse.redirect(await authorizationUrl("sign-in", google));
}
