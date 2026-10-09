import "server-only";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { env } from "../env";

/** A signed, http-only session cookie. Founders and site owners each get their own cookie name. */
export type CookieSession = { cookie: string; days: number };

function secretKey() {
  return new TextEncoder().encode(env.authSecret());
}

export async function writeSessionCookie(session: CookieSession, subject: string, claims: JWTPayload = {}) {
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject.toLowerCase())
    .setIssuedAt()
    .setExpirationTime(`${session.days}d`)
    .sign(secretKey());
  (await cookies()).set(session.cookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.days * 24 * 60 * 60,
  });
}

export async function readSessionCookie(session: CookieSession): Promise<JWTPayload | null> {
  const token = (await cookies()).get(session.cookie)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

export async function clearSessionCookie(session: CookieSession) {
  (await cookies()).delete(session.cookie);
}
