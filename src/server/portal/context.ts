import "server-only";
import { portalSitesFor, type PortalSite } from "../sites/clientSites";
import { requirePortalUser, type PortalUser } from "./session";

export type PortalContext = { user: PortalUser; sites: PortalSite[]; site: PortalSite };

/** The signed-in owner or editor and the site they're looking at: the one named by ?site=, or their first. */
export async function portalContext(slug?: string): Promise<PortalContext> {
  const user = await requirePortalUser();
  const sites = await portalSitesFor(user.email);
  return { user, sites, site: sites.find((site) => site.slug === slug) ?? sites[0] };
}

/** The site named by slug, if the signed-in person owns or edits it. */
export async function portalSite(user: PortalUser, slug: string): Promise<PortalSite | null> {
  return (await portalSitesFor(user.email)).find((site) => site.slug === slug) ?? null;
}

/** Billing, approving a launch and choosing who else can edit stay with the owner. */
export const isOwnerOf = (site: Pick<PortalSite, "role">) => site.role === "owner";

/** The Vercel project a live site's analytics are recorded under: saved at launch, or the name promote gives it. */
export const analyticsProject = (site: Pick<PortalSite, "slug" | "vercelProjectId">) => site.vercelProjectId || `site-${site.slug}`;
