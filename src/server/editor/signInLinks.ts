import "server-only";
import { SignJWT } from "jose";
import type { ClientSite } from "../db/schema";
import { env, isDevelopment } from "../env";
import { clientSitesOwnedBy } from "../sites/clientSites";
import { signInLinkSender } from "./linkSender";

export const LINK_MINUTES = 10;

/** site-kit's own fallback under `next dev` with EDITOR_DEV=1, so links work against a local starter. */
const DEV_ONLY_SECRET = "local-development-only-editor-secret";

function editorSecret(): Uint8Array | null {
  const secret = env.editorSecret() || (isDevelopment ? DEV_ONLY_SECRET : "");
  return secret ? new TextEncoder().encode(secret) : null;
}

export function linksReady(): boolean {
  return signInLinkSender().ready && editorSecret() !== null;
}

/**
 * The link site-kit's /edit/enter route accepts: an HS256 token signed with the
 * EDITOR_SECRET every client site shares, naming the owner and this one site.
 */
export async function signInLink(site: Pick<ClientSite, "slug" | "url">, email: string): Promise<string> {
  const key = editorSecret();
  if (!key) throw new Error("EDITOR_SECRET is not set.");
  const token = await new SignJWT({ site: site.slug, typ: "sign-in" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(`${LINK_MINUTES}m`)
    .sign(key);
  const url = new URL("/edit/enter", site.url);
  url.searchParams.set("token", token);
  return url.toString();
}

/** Mints and emails one link. Throws if the email service refuses it. */
export async function emailSignInLink(site: Pick<ClientSite, "slug" | "url" | "ownerEmail">) {
  const url = await signInLink(site, site.ownerEmail);
  await signInLinkSender().send({ to: site.ownerEmail, siteAddress: new URL(site.url).host, url, expiresInMinutes: LINK_MINUTES });
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
