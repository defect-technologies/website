import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { SignJWT } from "jose";
import { db } from "../db/client";
import { clientSites, editorLinks, type ClientSite } from "../db/schema";
import { env, isDevelopment } from "../env";
import { clientSitesOwnedBy } from "../sites/clientSites";
import { signInLinkSender } from "./linkSender";

export const LINK_MINUTES = 10;
/** How long the token handed to the client site lives. It only travels in the redirect, never in an email. */
const ENTER_SECONDS = 60;

/** site-kit's own fallback under `next dev` with EDITOR_DEV=1, so links work against a local starter. */
const DEV_ONLY_SECRET = "local-development-only-editor-secret";

const hash = (code: string) => createHash("sha256").update(code).digest("hex");

function editorSecret(): Uint8Array | null {
  const secret = env.editorSecret() || (isDevelopment ? DEV_ONLY_SECRET : "");
  return secret ? new TextEncoder().encode(secret) : null;
}

export function linksReady(): boolean {
  return signInLinkSender().ready && editorSecret() !== null;
}

/**
 * The URL site-kit's /edit/enter route accepts: an HS256 token signed with the
 * EDITOR_SECRET every client site shares, naming the owner and this one site.
 */
async function enterUrl(site: Pick<ClientSite, "slug" | "url">, email: string): Promise<string> {
  const key = editorSecret();
  if (!key) throw new Error("EDITOR_SECRET is not set.");
  const token = await new SignJWT({ site: site.slug, typ: "sign-in" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(`${ENTER_SECONDS}s`)
    .sign(key);
  const url = new URL("/edit/enter", site.url);
  url.searchParams.set("token", token);
  return url.toString();
}

/** Stores a new one-time code for the site's owner and emails the link. Throws if the email service refuses it. */
export async function emailSignInLink(site: Pick<ClientSite, "id" | "url" | "ownerEmail">) {
  const code = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_MINUTES * 60 * 1000);
  await (await db()).insert(editorLinks).values({ codeHash: hash(code), siteId: site.id, email: site.ownerEmail, expiresAt });
  const url = new URL("/edit/open", env.siteUrl());
  url.searchParams.set("code", code);
  await signInLinkSender().send({ to: site.ownerEmail, siteAddress: new URL(site.url).host, url: url.toString(), expiresInMinutes: LINK_MINUTES });
}

export type LinkState = { state: "ready"; siteAddress: string } | { state: "used" | "expired" | "unknown" };

function stateOf(link: { usedAt: Date | null; expiresAt: Date; email: string; ownerEmail: string; url: string }): LinkState {
  if (link.usedAt) return { state: "used" };
  if (link.expiresAt <= new Date() || link.email !== link.ownerEmail) return { state: "expired" };
  return { state: "ready", siteAddress: new URL(link.url).host };
}

/** Looks at a link without using it, so an email scanner opening the page doesn't spend it. */
export async function inspectSignInLink(code: string): Promise<LinkState> {
  if (!code) return { state: "unknown" };
  const [link] = await (await db())
    .select({ usedAt: editorLinks.usedAt, expiresAt: editorLinks.expiresAt, email: editorLinks.email, ownerEmail: clientSites.ownerEmail, url: clientSites.url })
    .from(editorLinks)
    .innerJoin(clientSites, eq(editorLinks.siteId, clientSites.id))
    .where(eq(editorLinks.codeHash, hash(code)));
  return link ? stateOf(link) : { state: "unknown" };
}

/**
 * Marks the link used and returns the client site's sign-in URL, or null if the
 * link is unknown, used, expired, or its site has a different owner now.
 */
export async function spendSignInLink(code: string): Promise<string | null> {
  if (!code) return null;
  const database = await db();
  const [used] = await database
    .update(editorLinks)
    .set({ usedAt: new Date() })
    .where(and(eq(editorLinks.codeHash, hash(code)), isNull(editorLinks.usedAt), gt(editorLinks.expiresAt, new Date())))
    .returning({ siteId: editorLinks.siteId, email: editorLinks.email });
  if (!used) return null;
  const [site] = await database.select().from(clientSites).where(eq(clientSites.id, used.siteId));
  if (!site || site.ownerEmail !== used.email) return null;
  return enterUrl(site, used.email);
}

export type LinkRequest = "sent" | "not-ready";

/**
 * Emails a link for every site the address owns, but always answers the same
 * way, so the form can't be used to find out who our clients are.
 */
export async function requestSignInLinks(rawEmail: string): Promise<LinkRequest> {
  if (!linksReady()) return "not-ready";
  for (const site of await clientSitesOwnedBy(rawEmail)) {
    try {
      await emailSignInLink(site);
    } catch (error) {
      // A different answer here would tell a stranger this address owns a site.
      console.error(`[editor] Sign-in email for ${site.slug} failed to send`, error);
    }
  }
  return "sent";
}
