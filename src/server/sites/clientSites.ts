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

export async function changeSiteOwner(slug: string, ownerEmail: string) {
  const [row] = await (await db())
    .update(clientSites)
    .set({ ownerEmail: ownerEmail.trim().toLowerCase() })
    .where(eq(clientSites.slug, slug))
    .returning();
  return row ?? null;
}
