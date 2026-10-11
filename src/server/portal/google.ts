import "server-only";
import { cookies } from "next/headers";
import { safeNext, signInWithGoogle } from "./accounts";

/** Set when a Google sign-in started from the portal; holds where to land afterwards. */
export const PORTAL_NEXT_COOKIE = "defect_portal_next";

/** The portal page to land on if this Google sign-in started from the portal, or null for a founder's sign-in. */
export async function takePortalNext(): Promise<string | null> {
  const jar = await cookies();
  const next = jar.get(PORTAL_NEXT_COOKIE)?.value;
  jar.delete(PORTAL_NEXT_COOKIE);
  return next === undefined ? null : safeNext(next);
}

export async function finishPortalGoogle(email: string, next: string): Promise<string> {
  return (await signInWithGoogle(email)) ? next : "/portal/sign-in?error=no-site";
}
