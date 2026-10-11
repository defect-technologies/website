import { NextResponse, type NextRequest } from "next/server";
import { authorizationUrl, googleClient } from "@/server/auth/google";
import { env } from "@/server/env";
import { safeNext } from "@/server/portal/accounts";
import { PORTAL_NEXT_COOKIE } from "@/server/portal/google";

/** ?portal=<next> starts a client's portal sign-in; without it, a founder's admin sign-in. */
export async function GET(request: NextRequest) {
  const portalNext = request.nextUrl.searchParams.get("portal");
  const google = googleClient("sign-in");
  if (!google || (portalNext !== null && !env.portalGoogle())) {
    return NextResponse.redirect(new URL(portalNext !== null ? "/portal/sign-in?error=google" : "/admin/sign-in?error=not-configured", env.siteUrl()));
  }
  const response = NextResponse.redirect(await authorizationUrl("sign-in", google));
  if (portalNext !== null) {
    response.cookies.set(PORTAL_NEXT_COOKIE, safeNext(portalNext), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  }
  return response;
}
