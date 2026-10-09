import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "defect_admin";

/**
 * An early, cheap check: no session cookie, no admin page. The real check
 * (a verified token for an allowed founder) runs in requireFounder on every
 * page, action, and route.
 */
export function proxy(request: NextRequest) {
  const isSignIn = request.nextUrl.pathname.startsWith("/admin/sign-in");
  if (!isSignIn && !request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/admin/sign-in", request.url));
  }
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
