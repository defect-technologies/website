import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, gte, isNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import { portalAccounts, portalFailedSignIns, portalLinks } from "../db/schema";
import { emailReady, sendPlainEmail } from "../editor/linkSender";
import { env } from "../env";
import { hashPassword, passwordMatches, PASSWORD_MIN } from "./passwords";
import { ownsASite, startOwnerSession } from "./session";

const LINK_MINUTES = 15;
const LINKS_PER_WINDOW = 3;
const FAILURES_ALLOWED = 5;
const LOCKOUT_MINUTES = 15;

const hash = (code: string) => createHash("sha256").update(code).digest("hex");
const normalize = (email: string) => email.trim().toLowerCase();
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000);

/** Only portal pages may follow a sign-in, so a link can't be used to send someone elsewhere. */
export function safeNext(next: string | null | undefined): string {
  return next && /^\/portal(\/[\w\-/]*)?$/.test(next) ? next : "/portal";
}

async function signIn(email: string) {
  await (await db())
    .insert(portalAccounts)
    .values({ email, lastSignInAt: new Date() })
    .onConflictDoUpdate({ target: portalAccounts.email, set: { lastSignInAt: new Date() } });
  await startOwnerSession(email);
}

async function failuresSince(email: string, minutes: number) {
  const [row] = await (await db())
    .select({ count: sql<number>`count(*)::int` })
    .from(portalFailedSignIns)
    .where(and(eq(portalFailedSignIns.email, email), gte(portalFailedSignIns.at, minutesAgo(minutes))));
  return row?.count ?? 0;
}

async function linksSince(email: string, minutes: number) {
  const [row] = await (await db())
    .select({ count: sql<number>`count(*)::int` })
    .from(portalLinks)
    .where(and(eq(portalLinks.email, email), gte(portalLinks.createdAt, minutesAgo(minutes))));
  return row?.count ?? 0;
}

export type PasswordSignIn = "signed-in" | "wrong" | "locked";

/** The same answer for an unknown email and a wrong password, so the form can't reveal who our clients are. */
export async function signInWithPassword(rawEmail: string, password: string): Promise<PasswordSignIn> {
  const email = normalize(rawEmail);
  if ((await failuresSince(email, LOCKOUT_MINUTES)) >= FAILURES_ALLOWED) return "locked";
  const [account] = await (await db()).select().from(portalAccounts).where(eq(portalAccounts.email, email));
  const matches = Boolean(account?.passwordHash) && (await passwordMatches(password, account.passwordHash));
  if (!matches || !(await ownsASite(email))) {
    await (await db()).insert(portalFailedSignIns).values({ email });
    return "wrong";
  }
  await signIn(email);
  return "signed-in";
}

function linkEmailText(url: string): string {
  return [
    "Hi,",
    "",
    `Here's your link to sign in to your Defect Technologies portal. It works once, within the next ${LINK_MINUTES} minutes:`,
    url,
    "",
    "If you didn't ask for this, you can ignore this email and nothing will change.",
    "",
    "Warmly,",
    "The Defect Technologies team",
    "hello@defect.tech",
  ].join("\n");
}

export type LinkRequest = "sent" | "not-ready";

/** Emails a one-time sign-in link to an owner. Answers "sent" either way, so nobody learns who owns a site. */
export async function emailPortalLink(rawEmail: string, next: string): Promise<LinkRequest> {
  if (!emailReady()) return "not-ready";
  const email = normalize(rawEmail);
  if (!(await ownsASite(email))) return "sent";
  if ((await linksSince(email, LINK_MINUTES)) >= LINKS_PER_WINDOW) return "sent";
  const code = randomBytes(32).toString("base64url");
  await (await db()).insert(portalLinks).values({ codeHash: hash(code), email, next: safeNext(next), expiresAt: new Date(Date.now() + LINK_MINUTES * 60 * 1000) });
  const url = new URL("/portal/open", env.siteUrl());
  url.searchParams.set("code", code);
  try {
    await sendPlainEmail({ to: email, subject: "Your link to sign in to Defect Technologies", text: linkEmailText(url.toString()) });
  } catch (error) {
    console.error("[portal] Sign-in email failed to send", error);
  }
  return "sent";
}

/** Looks without spending, so mail scanners that open links on arrival don't use them up. */
export async function portalLinkIsGood(code: string): Promise<boolean> {
  if (!code) return false;
  const [link] = await (await db())
    .select({ email: portalLinks.email })
    .from(portalLinks)
    .where(and(eq(portalLinks.codeHash, hash(code)), isNull(portalLinks.usedAt), gt(portalLinks.expiresAt, new Date())));
  return Boolean(link);
}

/** Spends the link and signs its owner in. Returns where to go next, or null if the link is no good. */
export async function signInWithLink(code: string): Promise<string | null> {
  if (!code) return null;
  const [link] = await (await db())
    .update(portalLinks)
    .set({ usedAt: new Date() })
    .where(and(eq(portalLinks.codeHash, hash(code)), isNull(portalLinks.usedAt), gt(portalLinks.expiresAt, new Date())))
    .returning({ email: portalLinks.email, next: portalLinks.next });
  if (!link || !(await ownsASite(link.email))) return null;
  await signIn(link.email);
  return safeNext(link.next);
}

/** Signs in someone Google has vouched for, if they own a site. */
export async function signInWithGoogle(email: string): Promise<boolean> {
  if (!(await ownsASite(normalize(email)))) return false;
  await signIn(normalize(email));
  return true;
}

export async function hasPassword(email: string): Promise<boolean> {
  const [account] = await (await db()).select({ passwordHash: portalAccounts.passwordHash }).from(portalAccounts).where(eq(portalAccounts.email, email));
  return Boolean(account?.passwordHash);
}

export type PasswordChange = "saved" | "too-short" | "wrong-current";

/** An owner already signed in sets a password; changing one needs the current one. */
export async function setPassword(email: string, current: string, next: string): Promise<PasswordChange> {
  if (next.length < PASSWORD_MIN) return "too-short";
  const [account] = await (await db()).select().from(portalAccounts).where(eq(portalAccounts.email, email));
  if (account?.passwordHash && !(await passwordMatches(current, account.passwordHash))) return "wrong-current";
  const saved = { passwordHash: await hashPassword(next), passwordSetAt: new Date() };
  await (await db())
    .insert(portalAccounts)
    .values({ email, ...saved })
    .onConflictDoUpdate({ target: portalAccounts.email, set: saved });
  return "saved";
}
