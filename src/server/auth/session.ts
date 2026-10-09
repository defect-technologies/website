import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { env } from "../env";
import { clearSessionCookie, readSessionCookie, writeSessionCookie, type CookieSession } from "./signedCookie";

export const SESSION_COOKIE = "defect_admin";
const FOUNDER_SESSION: CookieSession = { cookie: SESSION_COOKIE, days: 30 };

export type Founder = { email: string; name: string };

export function isFounder(email: string) {
  return env.founderEmails().includes(email.trim().toLowerCase());
}

export async function startSession(founder: Founder) {
  await writeSessionCookie(FOUNDER_SESSION, founder.email, { name: founder.name });
}

export async function endSession() {
  await clearSessionCookie(FOUNDER_SESSION);
}

async function readSession(): Promise<Founder | null> {
  const payload = await readSessionCookie(FOUNDER_SESSION);
  const email = payload?.sub ?? "";
  // Removing someone from ADMIN_EMAILS signs them out on their next request.
  if (!payload || !isFounder(email)) return null;
  return { email, name: typeof payload.name === "string" ? payload.name : email };
}

export const currentFounder = cache(readSession);

/** The gate for every admin page, server action, and route handler. */
export async function requireFounder(): Promise<Founder> {
  const founder = await currentFounder();
  if (!founder) redirect("/admin/sign-in");
  return founder;
}
