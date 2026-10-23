import "server-only";
import { and, asc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { db, type Db } from "../db/client";
import { businesses, clientSiteEditors, clientSites, type Business, type ClientSite } from "../db/schema";
import { normalizeEmail } from "./siteEditors";

export type ClientSiteRow = ClientSite & { businessName: string | null };

const withBusiness = {
  id: clientSites.id,
  slug: clientSites.slug,
  ownerEmail: clientSites.ownerEmail,
  url: clientSites.url,
  businessId: clientSites.businessId,
  createdAt: clientSites.createdAt,
  createdBy: clientSites.createdBy,
  businessName: businesses.businessName,
};

const selectSites = (database: Db) => database.select(withBusiness).from(clientSites).leftJoin(businesses, eq(clientSites.businessId, businesses.id));

export async function allClientSites(): Promise<ClientSiteRow[]> {
  return selectSites(await db()).orderBy(asc(clientSites.slug));
}

export async function clientSite(slug: string): Promise<ClientSiteRow | null> {
  const [row] = await selectSites(await db()).where(eq(clientSites.slug, slug));
  return row ?? null;
}

/** The owner pays and asks us for changes. An editor can sign in to the portal and edit the site, nothing more. */
export type SiteRole = "owner" | "editor";

export type PortalSite = ClientSiteRow & { stripeCustomerId: string | null; vercelProjectId: string | null; launchedAt: Date | null; role: SiteRole };

/** A client's account exists from the moment they pay; their website is live once it launches. A site added by hand has no lead and is live. */
export const isLive = (site: Pick<PortalSite, "businessId" | "launchedAt">) => !site.businessId || Boolean(site.launchedAt);

function ownedOrEditedBy(database: Db, email: string) {
  const edited = database.select({ siteId: clientSiteEditors.siteId }).from(clientSiteEditors).where(eq(clientSiteEditors.email, email));
  return or(eq(clientSites.ownerEmail, email), inArray(clientSites.id, edited));
}

/** The sites someone sees in their portal, owned or edited, with what the portal needs to name them, open billing and read analytics. */
export async function portalSitesFor(rawEmail: string): Promise<PortalSite[]> {
  const email = normalizeEmail(rawEmail);
  const database = await db();
  const rows = await database
    .select({ ...withBusiness, stripeCustomerId: businesses.stripeCustomerId, vercelProjectId: businesses.vercelProjectId, launchedAt: businesses.launchedAt })
    .from(clientSites)
    .leftJoin(businesses, eq(clientSites.businessId, businesses.id))
    .where(ownedOrEditedBy(database, email))
    .orderBy(asc(clientSites.slug));
  return rows.map((row) => ({ ...row, role: row.ownerEmail === email ? "owner" : "editor" }));
}

/** Owning or editing any site is what lets someone into the portal. */
export async function hasPortalAccess(rawEmail: string): Promise<boolean> {
  const database = await db();
  const [row] = await database.select({ id: clientSites.id }).from(clientSites).where(ownedOrEditedBy(database, normalizeEmail(rawEmail))).limit(1);
  return Boolean(row);
}

/** Every live site with the Vercel project its launch recorded, for counting analytics across all of them. Accounts whose website hasn't launched have no analytics yet. */
export type SiteWithProject = {
  slug: string;
  url: string;
  ownerEmail: string;
  ownerFirstName: string | null;
  businessId: string | null;
  businessName: string | null;
  vercelProjectId: string | null;
};

export async function sitesWithProjects(): Promise<SiteWithProject[]> {
  return (await db())
    .select({
      slug: clientSites.slug,
      url: clientSites.url,
      ownerEmail: clientSites.ownerEmail,
      ownerFirstName: businesses.ownerFirstName,
      businessId: clientSites.businessId,
      businessName: businesses.businessName,
      vercelProjectId: businesses.vercelProjectId,
    })
    .from(clientSites)
    .leftJoin(businesses, eq(clientSites.businessId, businesses.id))
    .where(or(isNull(clientSites.businessId), isNotNull(businesses.launchedAt)))
    .orderBy(asc(clientSites.slug));
}

/** Opens a client's portal when they pay, before their website is live, at its preview's address until the launch replaces it. */
export async function openPortal(business: Business, ownerEmail: string, createdBy: string) {
  if (!ownerEmail || !business.previewUrl) return null;
  return addClientSite({ slug: business.slug, ownerEmail, url: business.previewUrl, businessId: business.id, createdBy });
}

/** Returns null when the slug is already taken. */
export async function addClientSite(input: { slug: string; ownerEmail: string; url: string; businessId: string | null; createdBy: string }) {
  const [row] = await (await db())
    .insert(clientSites)
    .values({ ...input, ownerEmail: normalizeEmail(input.ownerEmail), url: input.url.replace(/\/$/, "") })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

/** A launch records where the site now lives, replacing the address it had before it went live. The owner stays as is. */
export async function saveLaunchedSite(input: { slug: string; ownerEmail: string; url: string; businessId: string; createdBy: string }) {
  const url = input.url.replace(/\/$/, "");
  await (await db())
    .insert(clientSites)
    .values({ ...input, ownerEmail: normalizeEmail(input.ownerEmail), url })
    .onConflictDoUpdate({ target: clientSites.slug, set: { url, businessId: input.businessId } });
}

/** A new owner who was an editor stops being one, so each address has one role on a site. */
export async function changeSiteOwner(slug: string, rawOwnerEmail: string) {
  const ownerEmail = normalizeEmail(rawOwnerEmail);
  const database = await db();
  const [row] = await database.update(clientSites).set({ ownerEmail }).where(eq(clientSites.slug, slug)).returning();
  if (row) await database.delete(clientSiteEditors).where(and(eq(clientSiteEditors.siteId, row.id), eq(clientSiteEditors.email, ownerEmail)));
  return row ?? null;
}
