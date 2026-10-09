import "server-only";
import type { OutreachSettings } from "@/lib/emailTemplate";
import type { Business } from "../db/schema";

/** Single-quotes a value for a POSIX shell. Websites come from scraped pages, so they're never pasted in raw. */
function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** The lead's Stripe payment link, tagged with its ID so the payment can be matched back to it. */
export function checkoutLink(business: Business, settings: OutreachSettings): string {
  const base = business.priceArm ? settings.checkoutLinks[String(business.priceArm) as "59" | "79"] : "";
  if (!base) return "";
  const url = new URL(base);
  url.searchParams.set("client_reference_id", business.id);
  return url.toString();
}

/** What to run in core/engine to build this lead's preview at its price, and report it back here. */
export function buildCommand(business: Business, settings: OutreachSettings): string {
  const price = business.priceArm ?? 59;
  return [
    `PRICE=${price}`,
    `CHECKOUT_URL=${shellQuote(checkoutLink(business, settings))}`,
    "preview/build_preview.sh",
    shellQuote(business.website),
    business.slug,
    "--deploy",
  ].join(" ");
}
