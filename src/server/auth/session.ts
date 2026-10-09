import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { env } from "../env";

export const SESSION_COOKIE = "defect_admin";
const SESSION_DAYS = 30;

export type Founder = { email: string; name: string };

function secretKey() {
  return new TextEncoder().encode(env.authSecret());
}

export function isFounder(email: string) {
  return env.founderEmails().includes(email.trim().toLowerCase());
}

export async function startSession(founder: Founder) {
  const token = await new SignJWT({ name: founder.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(founder.email.toLowerCase())
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

async function readSession(): Promise<Founder | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const email = payload.sub ?? "";
    // Removing someone from ADMIN_EMAILS signs them out on their next request.
    if (!isFounder(email)) return null;
    return { email, name: typeof payload.name === "string" ? payload.name : email };
  } catch {
    return null;
  }
}

export const currentFounder = cache(readSession);

/** The gate for every admin page, server action, and route handler. */
export async function requireFounder(): Promise<Founder> {
  const founder = await currentFounder();
  if (!founder) redirect("/admin/sign-in");
  return founder;
}
