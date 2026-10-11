import "server-only";
import { neon } from "@neondatabase/serverless";
import { env } from "../env";
import { integration } from "./result";

export type SiteChange = { id: number; site: string; key: string; actor: string; action: string; summary: string; at: Date };

/** Enough to search a month of edits across every client site; the page folds all but the newest few. */
const LIMIT = 500;

/**
 * Changes to client sites' content in the last `days` days (or ever), newest first, from the change log the
 * client-content database writes on every save. Read through a read-only role.
 */
export function recentSiteChanges(days: number | null = null) {
  const url = env.sitesDatabaseUrl();
  return integration({ SITES_DATABASE_URL: url }, async () => {
    const after = new Date(days ? Date.now() - days * 86_400_000 : 0).toISOString();
    const rows = await neon(url)`select id, site, key, actor, action, summary, at from site_changes where at >= ${after} order by at desc, id desc limit ${LIMIT}`;
    return rows.map((row) => ({ ...(row as Omit<SiteChange, "at">), summary: (row.summary as string | null) ?? "", at: new Date(row.at as string) }));
  });
}
