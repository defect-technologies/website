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
 * Where client sites' content.json lives. The editor only talks to this.
 *
 * Today: Postgres (DatabaseSiteStore). Later: the private client-sites Git
 * repository, where save() becomes a commit to <slug>/content.json through
 * a GitHub App, versions() reads that file's commit history, and the
 * owner-to-site mapping is a file in the same repository.
 */
export interface SiteStore {
  sitesFor(ownerEmail: string): Promise<StoredSite[]>;
  site(slug: string): Promise<StoredSite | null>;
  save(request: SaveRequest): Promise<SaveResult>;
  versions(slug: string): Promise<VersionSummary[]>;
  versionContent(slug: string, version: number): Promise<SiteContent | null>;
}
