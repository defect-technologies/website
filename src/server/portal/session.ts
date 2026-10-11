import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { clearSessionCookie, readSessionCookie, writeSessionCookie, type CookieSession } from "../auth/signedCookie";
import { clientSitesOwnedBy } from "../sites/clientSites";

const PORTAL_SESSION: CookieSession = { cookie: "defect_portal", days: 30 };

export type Owner = { email: string };

export async function startOwnerSession(email: string) {
  await writeSessionCookie(PORTAL_SESSION, email);
}

export async function endOwnerSession() {
  await clearSessionCookie(PORTAL_SESSION);
}

/** Owning a site is what lets someone in, so handing the site to someone else signs the old owner out. */
export async function ownsASite(email: string): Promise<boolean> {
  return (await clientSitesOwnedBy(email)).length > 0;
}

async function readOwner(): Promise<Owner | null> {
  const email = (await readSessionCookie(PORTAL_SESSION))?.sub ?? "";
  return email && (await ownsASite(email)) ? { email } : null;
}

export const currentOwner = cache(readOwner);

export async function requireOwner(): Promise<Owner> {
  const owner = await currentOwner();
  if (!owner) redirect("/portal/sign-in");
  return owner;
}
