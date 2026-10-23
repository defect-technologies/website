import "server-only";
import type { Business } from "@/server/db/schema";
import { welcomeLink } from "@/server/outreach/compose";
import type { PreviewGuard } from "./previewReports";

/** Why a preview's page can't be sent to this lead, or null when its "Make it live" button goes to their checkout. */
export function checkoutProblem(html: string, welcomeUrl: string): string | null {
  if (html.includes(`href="${welcomeUrl}"`)) return null;
  if (html.includes("/welcome/")) return `its checkout button goes to another lead, not ${welcomeUrl}`;
  return `its checkout button has no link (deployed without CHECKOUT_URL=${welcomeUrl})`;
}

/** A deploy only becomes the lead's link when its home page loads and sells to that lead. */
export const previewSellsToLead: PreviewGuard = async (business: Business, previewUrl: string) => {
  try {
    const response = await fetch(previewUrl, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return `its home page answered ${response.status}`;
    return checkoutProblem(await response.text(), welcomeLink(business));
  } catch (error) {
    return `its home page didn't load (${(error as Error).message})`;
  }
};
