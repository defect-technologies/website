import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { SignJWT } from "jose";
import { db } from "../db/client";
import { businesses, clientSites, editorLinks, type ClientSite } from "../db/schema";
import { env, isDevelopment } from "../env";
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
export async function enterUrl(site: Pick<ClientSite, "slug" | "url">, email: string): Promise<string> {
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

/** What the owner calls their site: "G Studio Website", or its address when it has no business on file. */
export function siteName(businessName: string | null, url: string): string {
  return businessName ? `${businessName} Website` : new URL(url).host;
}

async function businessNameOf(businessId: string | null): Promise<string | null> {
  if (!businessId) return null;
  const [row] = await (await db()).select({ name: businesses.businessName }).from(businesses).where(eq(businesses.id, businessId));
  return row?.name || null;
}

/** Stores a new one-time code for the site's owner and emails the link. Throws if the email service refuses it. */
export async function emailSignInLink(site: Pick<ClientSite, "id" | "url" | "ownerEmail" | "businessId">) {
  const code = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_MINUTES * 60 * 1000);
  await (await db()).insert(editorLinks).values({ codeHash: hash(code), siteId: site.id, email: site.ownerEmail, expiresAt });
  const url = new URL("/edit/open", env.siteUrl());
  url.searchParams.set("code", code);
  const name = siteName(await businessNameOf(site.businessId), site.url);
  await signInLinkSender().send({ to: site.ownerEmail, siteName: name, editUrl: `${site.url}/edit`, url: url.toString(), expiresInMinutes: LINK_MINUTES });
}

export type LinkState = { state: "ready"; siteName: string } | { state: "used" | "expired"; slug: string } | { state: "unknown" };

type InspectedLink = { usedAt: Date | null; expiresAt: Date; email: string; ownerEmail: string; url: string; slug: string; businessName: string | null };

function stateOf(link: InspectedLink): LinkState {
  if (link.usedAt) return { state: "used", slug: link.slug };
  if (link.expiresAt <= new Date() || link.email !== link.ownerEmail) return { state: "expired", slug: link.slug };
  return { state: "ready", siteName: siteName(link.businessName, link.url) };
}

/** Looks at a link without using it, so an email scanner opening the page doesn't spend it. */
export async function inspectSignInLink(code: string): Promise<LinkState> {
  if (!code) return { state: "unknown" };
  const [link] = await (await db())
    .select({
      usedAt: editorLinks.usedAt,
      expiresAt: editorLinks.expiresAt,
      email: editorLinks.email,
      ownerEmail: clientSites.ownerEmail,
      url: clientSites.url,
      slug: clientSites.slug,
      businessName: businesses.businessName,
    })
    .from(editorLinks)
    .innerJoin(clientSites, eq(editorLinks.siteId, clientSites.id))
    .leftJoin(businesses, eq(clientSites.businessId, businesses.id))
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

/** b•••@g.studio: enough for the owner to recognize their address, too little for a stranger to learn it. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}•••@${domain}`;
}

