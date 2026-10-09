import "server-only";
import type { SiteContent } from "@/lib/siteContent";
import { createSite } from "../sites/databaseStore";
import { siteStore } from "../sites/editing";
import sampleContent from "./sampleSiteContent.json";

/** A made-up florist from core/engine/preview/examples/sample-content.json. The business doesn't exist. */
export const SAMPLE_OWNER_EMAIL = "ana@sunriseflorist.example";
const SAMPLE_SLUG = "sunrise-florist";

export async function ensureSampleSite() {
  const existing = await siteStore.site(SAMPLE_SLUG);
  if (existing) return existing;
  return createSite({ slug: SAMPLE_SLUG, ownerEmail: SAMPLE_OWNER_EMAIL, content: sampleContent as SiteContent, createdBy: "sample" });
}
