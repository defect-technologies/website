import "server-only";
import { sitesForOwner, type OwnerSite } from "../sites/clientSites";
import { requireOwner, type Owner } from "./session";

export type PortalContext = { owner: Owner; sites: OwnerSite[]; site: OwnerSite };

/** The signed-in owner and the site they're looking at: the one named by ?site=, or their first. */
export async function portalContext(slug?: string): Promise<PortalContext> {
  const owner = await requireOwner();
  const sites = await sitesForOwner(owner.email);
  return { owner, sites, site: sites.find((site) => site.slug === slug) ?? sites[0] };
}

/** The Vercel project a live site's analytics are recorded under: saved at launch, or the name promote gives it. */
export const analyticsProject = (site: Pick<OwnerSite, "slug" | "vercelProjectId">) => site.vercelProjectId || `site-${site.slug}`;
