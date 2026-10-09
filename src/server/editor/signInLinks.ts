import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { signInLinks } from "../db/schema";
import { env } from "../env";
import { siteStore } from "../sites/editing";
import { signInLinkSender } from "./linkSender";

const LINK_MINUTES = 20;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export type LinkRequest = "sent" | "not-ready";

/**
 * Sends a link only when the address owns a site, but always answers the same
 * way, so the form can't be used to find out who our clients are.
 */
export async function requestSignInLink(rawEmail: string): Promise<LinkRequest> {
  const sender = signInLinkSender();
  if (!sender.ready) return "not-ready";
  const email = rawEmail.trim().toLowerCase();
  const owned = await siteStore.sitesFor(email);
  if (owned.length === 0) return "sent";

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_MINUTES * 60 * 1000);
  await (await db()).insert(signInLinks).values({ tokenHash: hash(token), email, expiresAt });
  const url = new URL("/edit/link", env.siteUrl());
  url.searchParams.set("token", token);
  await sender.send({ to: email, url: url.toString(), expiresInMinutes: LINK_MINUTES });
  return "sent";
}

/** Marks the link used and returns its email, or null if it's unknown, used, or expired. */
export async function redeemSignInLink(token: string): Promise<string | null> {
  if (!token) return null;
  const [used] = await (await db())
    .update(signInLinks)
    .set({ usedAt: new Date() })
    .where(and(eq(signInLinks.tokenHash, hash(token)), isNull(signInLinks.usedAt), gt(signInLinks.expiresAt, new Date())))
    .returning({ email: signInLinks.email });
  return used?.email ?? null;
}
