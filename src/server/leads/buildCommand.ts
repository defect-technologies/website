import "server-only";
import type { Business } from "../db/schema";
import { welcomeLink } from "../outreach/compose";

/** Single-quotes a value for a POSIX shell. Websites come from scraped pages, so they're never pasted in raw. */
function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** For a business with no website, what the builder works from instead of a crawl: build_preview.sh --brief. */
export function buildBrief(business: Business): string {
  return business.website ? "" : JSON.stringify({ businessName: business.businessName, about: business.brief });
}

/** What to run in core/engine to build this lead's preview at its price, and report it back here. */
export function buildCommand(business: Business): string {
  const price = business.priceArm ?? 59;
  const source = business.website ? shellQuote(business.website) : `--brief ${shellQuote(buildBrief(business))}`;
  return [
    `PRICE=${price}`,
    `CHECKOUT_URL=${shellQuote(welcomeLink(business))}`,
    "preview/build_preview.sh",
    source,
    business.slug,
    "--deploy",
  ].join(" ");
}
