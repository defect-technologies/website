import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { record } from "../activity";
import { db } from "../db/client";
import { clientSiteEditors, clientSites, type ClientSite, type ClientSiteEditor } from "../db/schema";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

type SiteOwnership = Pick<ClientSite, "id" | "ownerEmail">;
type EditedSite = SiteOwnership & Pick<ClientSite, "url" | "businessId">;

export async function editorsOf(siteId: string): Promise<ClientSiteEditor[]> {
  return (await db()).select().from(clientSiteEditors).where(eq(clientSiteEditors.siteId, siteId)).orderBy(asc(clientSiteEditors.addedAt));
}

/** Every site's editors by site ID, so their edits count as the client's own. */
export async function editorEmailsBySite(): Promise<Map<string, string[]>> {
  const bySite = new Map<string, string[]>();
  const rows = await (await db()).select({ siteId: clientSiteEditors.siteId, email: clientSiteEditors.email }).from(clientSiteEditors);
  for (const { siteId, email } of rows) bySite.set(siteId, [...(bySite.get(siteId) ?? []), email]);
  return bySite;
}

export async function editorEmailsOfBusiness(businessId: string): Promise<string[]> {
  const rows = await (await db())
    .select({ email: clientSiteEditors.email })
    .from(clientSiteEditors)
    .innerJoin(clientSites, eq(clientSiteEditors.siteId, clientSites.id))
    .where(eq(clientSites.businessId, businessId))
    .orderBy(asc(clientSiteEditors.email));
  return rows.map((row) => row.email);
}

export type EditedSiteOf ={ email: string; slug: string; url: string; businessId: string | null; ownerEmail: string };

/** The sites each of these addresses edits, for telling a known editor apart from a stranger. */
export async function sitesEditedBy(rawEmails: string[]): Promise<EditedSiteOf[]> {
  const emails = [...new Set(rawEmails.map(normalizeEmail).filter(Boolean))];
  if (!emails.length) return [];
  return (await db())
    .select({ email: clientSiteEditors.email, slug: clientSites.slug, url: clientSites.url, businessId: clientSites.businessId, ownerEmail: clientSites.ownerEmail })
    .from(clientSiteEditors)
    .innerJoin(clientSites, eq(clientSiteEditors.siteId, clientSites.id))
    .where(inArray(clientSiteEditors.email, emails));
}

export async function isSiteEditor(siteId: string, email: string): Promise<boolean> {
  const [row] = await (await db())
    .select({ email: clientSiteEditors.email })
    .from(clientSiteEditors)
    .where(and(eq(clientSiteEditors.siteId, siteId), eq(clientSiteEditors.email, normalizeEmail(email))));
  return Boolean(row);
}

/** The owner and every editor may open the site's editor. */
export async function canEditSite(site: SiteOwnership, email: string): Promise<boolean> {
  if (normalizeEmail(email) === site.ownerEmail) return true;
  return isSiteEditor(site.id, email);
}

export type EditorAdded = "added" | "already-editor" | "is-owner";

export async function addSiteEditor(site: SiteOwnership, rawEmail: string, addedBy: string): Promise<EditorAdded> {
  const email = normalizeEmail(rawEmail);
  if (email === site.ownerEmail) return "is-owner";
  const inserted = await (await db()).insert(clientSiteEditors).values({ siteId: site.id, email, addedBy }).onConflictDoNothing().returning({ email: clientSiteEditors.email });
  return inserted.length ? "added" : "already-editor";
}

/** Returns false when the address wasn't an editor of this site. */
export async function removeSiteEditor(siteId: string, rawEmail: string): Promise<boolean> {
  const removed = await (await db())
    .delete(clientSiteEditors)
    .where(and(eq(clientSiteEditors.siteId, siteId), eq(clientSiteEditors.email, normalizeEmail(rawEmail))))
    .returning({ email: clientSiteEditors.email });
  return removed.length > 0;
}

const EditorEmail = z.email().max(200);

export type EditorAddResult = EditorAdded | "invalid";

/** Adds an editor and logs who did it. Founders and owners both come through here. */
export async function addEditorAndRecord(site: EditedSite, rawEmail: string, actor: string): Promise<EditorAddResult> {
  const parsed = EditorEmail.safeParse(normalizeEmail(rawEmail));
  if (!parsed.success) return "invalid";
  const result = await addSiteEditor(site, parsed.data, actor);
  if (result === "added") await record(actor, "added a site editor", { businessId: site.businessId, detail: `${parsed.data} can now edit ${site.url}` });
  return result;
}

export async function removeEditorAndRecord(site: EditedSite, rawEmail: string, actor: string): Promise<boolean> {
  const removed = await removeSiteEditor(site.id, rawEmail);
  if (removed) await record(actor, "removed a site editor", { businessId: site.businessId, detail: `${normalizeEmail(rawEmail)} can no longer edit ${site.url}` });
  return removed;
}
