import "server-only";
import { neon } from "@neondatabase/serverless";
import { env } from "../env";
import { integration } from "./result";

export type SiteChange = { id: number; site: string; key: string; actor: string; action: string; at: Date };

const RECENT = 15;

/**
 * The latest changes to client sites' content, from the change log the
 * client-content database writes on every save. Read through a read-only role.
 */
export function recentSiteChanges() {
  const url = env.sitesDatabaseUrl();
  return integration({ SITES_DATABASE_URL: url }, async () => {
    const rows = await neon(url)`select id, site, key, actor, action, at from site_changes order by at desc, id desc limit ${RECENT}`;
    return rows.map((row) => ({ ...(row as Omit<SiteChange, "at">), at: new Date(row.at as string) }));
  });
}
