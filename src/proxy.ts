import { NextResponse, type NextRequest } from "next/server";

type Area = { prefix: string; cookie: string; publicPaths: string[]; signIn: string };

/** The founders' admin. Owners sign in on their own sites, so /edit here has no session. */
const AREAS: Area[] = [{ prefix: "/admin", cookie: "defect_admin", publicPaths: ["/admin/sign-in"], signIn: "/admin/sign-in" }];

/**
 * An early, cheap check: no session cookie, no page. The real check (a
 * verified token for an allowed founder) runs in requireFounder on every
 * page, action, and route.
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const area = AREAS.find((candidate) => path.startsWith(candidate.prefix));
  const isPublic = area?.publicPaths.some((publicPath) => path.startsWith(publicPath));
  if (area && !isPublic && !request.cookies.has(area.cookie)) {
    return NextResponse.redirect(new URL(area.signIn, request.url));
  }
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/edit/:path*", "/edit"],
};
