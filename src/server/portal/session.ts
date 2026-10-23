import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { clearSessionCookie, readSessionCookie, writeSessionCookie, type CookieSession } from "../auth/signedCookie";
import { hasPortalAccess } from "../sites/clientSites";

const PORTAL_SESSION: CookieSession = { cookie: "defect_portal", days: 30 };

/** Someone signed in to the portal: a site's owner, an editor, or both on different sites. */
export type PortalUser = { email: string };

export async function startPortalSession(email: string) {
  await writeSessionCookie(PORTAL_SESSION, email);
}

export async function endPortalSession() {
  await clearSessionCookie(PORTAL_SESSION);
}

/** Owning or editing a site is what lets someone in, so losing the last one signs them out. */
async function readPortalUser(): Promise<PortalUser | null> {
  const email = (await readSessionCookie(PORTAL_SESSION))?.sub ?? "";
  return email && (await hasPortalAccess(email)) ? { email } : null;
}

export const currentPortalUser = cache(readPortalUser);

export async function requirePortalUser(): Promise<PortalUser> {
  const user = await currentPortalUser();
  if (!user) redirect("/portal/sign-in");
  return user;
}
