import "server-only";
import { applyEditable, describeChanges, editableFrom } from "@/lib/siteContent";
import { checkEdit } from "@/lib/siteContentRules";
import { record } from "../activity";
import type { Owner } from "../auth/ownerSession";
import type { Founder } from "../auth/session";
import { databaseSiteStore } from "./databaseStore";
import type { SiteStore, StoredSite } from "./store";

/** The one place that picks a backend. Swap in a Git-backed store here when client-sites exists. */
export const siteStore: SiteStore = databaseSiteStore;

export type EditOutcome = { ok: true; version: number; message: string } | { ok: false; problems: string[] };

/** The site, if this owner is the one on file for it. Anything else looks like a missing site. */
export async function ownedSite(owner: Owner, slug: string): Promise<StoredSite | null> {
  const site = await siteStore.site(slug);
  return site && site.ownerEmail === owner.email.toLowerCase() ? site : null;
}

const STALE = "This site changed in another tab or by our team since you opened it. Reload to see the latest, then make your change again.";

export async function saveOwnerEdit(owner: Owner, slug: string, baseVersion: number, input: unknown): Promise<EditOutcome> {
  const site = await ownedSite(owner, slug);
  if (!site) return { ok: false, problems: ["We couldn't find that site on your account."] };
  const checked = checkEdit(input);
  if (!checked.ok) return { ok: false, problems: checked.problems };
  const changed = describeChanges(editableFrom(site.content), checked.content);
  if (changed.length === 0) return { ok: true, version: site.version, message: "Nothing changed, so there was nothing to save." };

  const summary = `Changed ${changed.join(", ")}`;
  const saved = await siteStore.save({ slug, baseVersion, content: applyEditable(site.content, checked.content), summary, savedBy: owner.email });
  if (!saved.ok) return { ok: false, problems: [STALE] };
  await record(owner.email, "edited their site", { businessId: site.businessId, detail: `${site.businessName}, version ${saved.version}: ${summary.toLowerCase()}`, priority: "fyi" });
  return { ok: true, version: saved.version, message: "Saved. Your site is updating now." };
}

export async function restoreOwnerVersion(owner: Owner, slug: string, version: number): Promise<EditOutcome> {
  const site = await ownedSite(owner, slug);
  if (!site) return { ok: false, problems: ["We couldn't find that site on your account."] };
  const earlier = await siteStore.versionContent(slug, version);
  if (!earlier) return { ok: false, problems: ["That version doesn't exist anymore."] };
  // Only the owner-editable fields roll back, so a restore never undoes design or photo changes our team made since.
  const content = applyEditable(site.content, editableFrom(earlier));
  const summary = `Restored version ${version}`;
  const saved = await siteStore.save({ slug, baseVersion: site.version, content, summary, savedBy: owner.email });
  if (!saved.ok) return { ok: false, problems: [STALE] };
  await record(owner.email, "restored their site", { businessId: site.businessId, detail: `${site.businessName}: version ${version} is live again as version ${saved.version}`, priority: "fyi" });
  return { ok: true, version: saved.version, message: `Version ${version} is back. Your site is updating now.` };
}

/**
 * A founder rolling a site back to an earlier version, whole file, the way
 * reverting content.json to an earlier commit would. Owners' restores bring
 * back only their own fields; this brings back everything.
 */
export async function rollBackSite(founder: Founder, slug: string, version: number): Promise<EditOutcome> {
  const site = await siteStore.site(slug);
  if (!site) return { ok: false, problems: ["That site doesn't exist."] };
  const content = await siteStore.versionContent(slug, version);
  if (!content) return { ok: false, problems: ["That version doesn't exist."] };
  const saved = await siteStore.save({ slug, baseVersion: site.version, content, summary: `Rolled back to version ${version}`, savedBy: founder.email });
  if (!saved.ok) return { ok: false, problems: ["The site changed while you were looking. Reload and try again."] };
  await record(founder.email, "rolled back a site", { businessId: site.businessId, detail: `${site.businessName}: version ${version} is live again as version ${saved.version}` });
  return { ok: true, version: saved.version, message: `Version ${version} is live again.` };
}
