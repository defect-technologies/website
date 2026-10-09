import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { clearSessionCookie, readSessionCookie, writeSessionCookie, type CookieSession } from "./signedCookie";

/** Kept apart from the founder cookie, so signing in to edit a site never opens /admin. */
export const OWNER_SESSION_COOKIE = "defect_owner";
const OWNER_SESSION: CookieSession = { cookie: OWNER_SESSION_COOKIE, days: 14 };

export type Owner = { email: string };

export async function startOwnerSession(email: string) {
  await writeSessionCookie(OWNER_SESSION, email);
}

export async function endOwnerSession() {
  await clearSessionCookie(OWNER_SESSION);
}

async function readOwner(): Promise<Owner | null> {
  const payload = await readSessionCookie(OWNER_SESSION);
  return payload?.sub ? { email: payload.sub } : null;
}

export const currentOwner = cache(readOwner);

/** The gate for every editor page and action. Which sites the owner may touch is checked in the site store. */
export async function requireOwner(): Promise<Owner> {
  const owner = await currentOwner();
  if (!owner) redirect("/edit/sign-in");
  return owner;
}
