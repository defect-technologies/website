import "server-only";
import type { SiteContent } from "@/lib/siteContent";

export type StoredSite = {
  slug: string;
  businessId: string | null;
  ownerEmail: string;
  businessName: string;
  content: SiteContent;
  assetBaseUrl: string;
  liveUrl: string;
  version: number;
  updatedAt: Date;
  updatedBy: string;
};

export type VersionSummary = { version: number; summary: string; savedBy: string; savedAt: Date };

export type SaveRequest = {
  slug: string;
  /** The version the owner started editing from. A save over a newer version is refused, not merged. */
  baseVersion: number;
  content: SiteContent;
  summary: string;
  savedBy: string;
};

export type SaveResult = { ok: true; version: number } | { ok: false; reason: "not-found" | "stale" };

/**
 * Where client sites' content.json lives, and its one history: owners' edits,
 * our team's edits, and restores all land here as versions, the way every
 * change becomes a commit in the client-sites repository. Nothing writes a
 * site any other way.
 *
 * Today: Postgres (databaseSiteStore), a stand-in that departs from the spec,
 * which says "no database". The target: the private client-sites Git
 * repository, where save() becomes a commit to <slug>/content.json through
 * a GitHub App, versions() reads that file's commit history, and the
 * owner-to-site mapping is a file in the same repository.
 */
export interface SiteStore {
  allSites(): Promise<StoredSite[]>;
  sitesFor(ownerEmail: string): Promise<StoredSite[]>;
  site(slug: string): Promise<StoredSite | null>;
  save(request: SaveRequest): Promise<SaveResult>;
  versions(slug: string): Promise<VersionSummary[]>;
  versionContent(slug: string, version: number): Promise<SiteContent | null>;
}
