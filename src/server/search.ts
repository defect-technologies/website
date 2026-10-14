import "server-only";
import { desc, ilike, inArray, or } from "drizzle-orm";
import { leadStatus, type LeadStatus } from "@/lib/leadStatus";
import { db } from "./db/client";
import { businesses, previewJobs } from "./db/schema";

export type SearchHit = { id: string; name: string; where: string; status: LeadStatus };

const RESULTS = 8;

/** Businesses whose name, website, email, slug or owner email contains the text,. */
export async function searchSites(text: string): Promise<SearchHit[]> {
  const query = text.trim().slice(0, 100);
  if (query.length < 2) return [];
  const pattern = `%${query.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
  const database = await db();
  const found = await database
    .select()
    .from(businesses)
    .where(or(...[businesses.businessName, businesses.website, businesses.email, businesses.slug, businesses.ownerEmail].map((column) => ilike(column, pattern))))
    .orderBy(desc(businesses.updatedAt))
    .limit(RESULTS);
  if (found.length === 0) return [];
  const jobs = await database
    .selectDistinctOn([previewJobs.businessId], { businessId: previewJobs.businessId, status: previewJobs.status, step: previewJobs.step })
    .from(previewJobs)
    .where(inArray(previewJobs.businessId, found.map((lead) => lead.id)))
    .orderBy(previewJobs.businessId, desc(previewJobs.createdAt));
  const latest = new Map(jobs.map((job) => [job.businessId, job]));
  return found.map((lead) => {
    const job = latest.get(lead.id);
    return {
      id: lead.id,
      name: lead.businessName,
      where: (lead.siteUrl || lead.website || lead.email).replace(/^https?:\/\//, "").replace(/\/$/, ""),
      status: leadStatus(lead.stage, job?.status ?? null, job?.step ?? ""),
    };
  });
}
