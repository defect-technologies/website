import { NextResponse, type NextRequest } from "next/server";

type Area = { prefix: string; cookie: string; publicPaths: string[]; signIn: string };

/** Founders' admin and owners' editor each have their own cookie and their own way in. */
const AREAS: Area[] = [
  { prefix: "/admin", cookie: "defect_admin", publicPaths: ["/admin/sign-in"], signIn: "/admin/sign-in" },
  { prefix: "/edit", cookie: "defect_owner", publicPaths: ["/edit/sign-in", "/edit/link"], signIn: "/edit/sign-in" },
];

/**
 * An early, cheap check: no session cookie, no page. The real checks
 * (a verified token for an allowed founder or owner) run in requireFounder
 * and requireOwner on every page, action, and route.
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
