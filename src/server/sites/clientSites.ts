import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, type Db } from "../db/client";
import { businesses, clientSites, type ClientSite } from "../db/schema";

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

export type OwnerSite = ClientSiteRow & { stripeCustomerId: string | null; vercelProjectId: string | null };

/** The sites an owner sees in their portal, with what the portal needs to name them, open billing and read analytics. */
export async function sitesForOwner(email: string): Promise<OwnerSite[]> {
  return (await db())
    .select({ ...withBusiness, stripeCustomerId: businesses.stripeCustomerId, vercelProjectId: businesses.vercelProjectId })
    .from(clientSites)
    .leftJoin(businesses, eq(clientSites.businessId, businesses.id))
    .where(eq(clientSites.ownerEmail, email.trim().toLowerCase()))
    .orderBy(asc(clientSites.slug));
}

/** Every live site with the Vercel project its launch recorded, for counting analytics across all of them. */
export async function sitesWithProjects(): Promise<{ slug: string; businessId: string | null; businessName: string | null; vercelProjectId: string | null }[]> {
  return (await db())
    .select({ slug: clientSites.slug, businessId: clientSites.businessId, businessName: businesses.businessName, vercelProjectId: businesses.vercelProjectId })
    .from(clientSites)
    .leftJoin(businesses, eq(clientSites.businessId, businesses.id))
    .orderBy(asc(clientSites.slug));
}

export async function clientSitesOwnedBy(email: string): Promise<ClientSite[]> {
  return (await db()).select().from(clientSites).where(eq(clientSites.ownerEmail, email.trim().toLowerCase()));
}

/** Returns null when the slug is already taken. */
export async function addClientSite(input: { slug: string; ownerEmail: string; url: string; businessId: string | null; createdBy: string }) {
  const [row] = await (await db())
    .insert(clientSites)
    .values({ ...input, ownerEmail: input.ownerEmail.trim().toLowerCase(), url: input.url.replace(/\/$/, "") })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

/** A launch records where the site now lives, replacing the address it had before it went live. The owner stays as is. */
export async function saveLaunchedSite(input: { slug: string; ownerEmail: string; url: string; businessId: string; createdBy: string }) {
  const url = input.url.replace(/\/$/, "");
  await (await db())
    .insert(clientSites)
    .values({ ...input, ownerEmail: input.ownerEmail.trim().toLowerCase(), url })
    .onConflictDoUpdate({ target: clientSites.slug, set: { url, businessId: input.businessId } });
}

export async function changeSiteOwner(slug: string, ownerEmail: string) {
  const [row] = await (await db())
    .update(clientSites)
    .set({ ownerEmail: ownerEmail.trim().toLowerCase() })
    .where(eq(clientSites.slug, slug))
    .returning();
  return row ?? null;
}
