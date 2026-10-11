import "server-only";
import { domainOf } from "../mail/mime";

/** Email providers anyone can sign up to. Matching or blocking one of these by domain would tie every Gmail user together. */
export const SHARED_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "me.com",
  "aol.com", "comcast.net", "att.net", "sbcglobal.net", "verizon.net", "msn.com", "proton.me", "protonmail.com",
]);

/** Sites many businesses list as their website, so one business's page there says nothing about the next. */
const SHARED_WEBSITE_HOSTS = new Set([
  "facebook.com", "m.facebook.com", "instagram.com", "yelp.com", "linktr.ee", "google.com", "sites.google.com",
  "maps.google.com", "tiktok.com", "x.com", "twitter.com", "linkedin.com", "nextdoor.com",
]);

export type Contact = { email: string; website?: string | null; placeId?: string | null };

/**
 * What one business's opt-out blocks: its company email domain, or only its exact address when that's at a shared provider
 * like Gmail, plus its own website and its Google place. Any one match keeps the business from being emailed again.
 */
export function contactKeys({ email, website, placeId }: Contact): string[] {
  const address = email.trim().toLowerCase();
  const mailDomain = domainOf(address);
  const site = domainOf(website ?? "");
  const keys = [
    mailDomain && (SHARED_MAIL_DOMAINS.has(mailDomain) ? address : mailDomain),
    site && !SHARED_WEBSITE_HOSTS.has(site) ? site : "",
    placeId ? `place:${placeId}` : "",
  ];
  return [...new Set(keys.filter(Boolean))];
}

export const isBlocked = (blocked: Set<string>, contact: Contact) => contactKeys(contact).some((key) => blocked.has(key));

/** A key saved before opt-outs knew about shared providers: a bare "gmail.com" that would block every Gmail user. */
export const isSharedDomainKey = (key: string) => SHARED_MAIL_DOMAINS.has(key);
