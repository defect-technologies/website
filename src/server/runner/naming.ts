import "server-only";
import { z } from "zod";
import { record } from "../activity";
import type { Business } from "../db/schema";
import { updateBusiness } from "../leads/businesses";

/**
 * The business's name as the build read it from its own site (lead/raw.json), which the runner reports with its boards
 * and its finished builds. The lead finder's first guess is often a page title, a city or a domain: the Designs page
 * listed "Los Angeles, CA", "SECRETTATTOOART.COM" and "MySite" for Life Art Creations Tattoo, Secret Tattoo Art and
 * Styling Studio (Nov 15, 2026).
 */
export const BuildName = z.string().trim().min(1).max(120).optional();

/** The lead under the name its build uses, renamed when that differs from what the lead finder guessed. */
export async function withBuildName(lead: Business, name: string | undefined): Promise<Business> {
  if (!name || name === lead.businessName) return lead;
  await updateBusiness(lead.id, { businessName: name });
  await record("bot:runner", "renamed the lead from its build", { businessId: lead.id, detail: `${lead.businessName} → ${name}` });
  return { ...lead, businessName: name };
}
