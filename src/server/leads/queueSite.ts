import "server-only";
import { db } from "../db/client";
import { businesses, type Business, type PreviewJob } from "../db/schema";
import { record } from "../activity";
import { domainOf } from "../mail/mime";
import { requestPreview } from "../runner/jobs";
import { newLinkCode, uniqueSlug } from "./import";
import { INBOUND_PRICE_ARM } from "@/lib/inbound";

export interface QueueSiteInput {
  website: string;
  businessName?: string;
  note?: string;
  requestedBy: string;
}

export interface QueueSiteResult {
  lead: Business;
  job: PreviewJob;
  createdLead: boolean;
  createdJob: boolean;
}

/** "nikkeinexus.org" → "Nikkeinexus": a placeholder name until the builder reads the real one off the site. */
function nameFromDomain(domain: string): string {
  const base = domain.replace(/^www\./, "").split(".")[0] ?? domain;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Queues a business's preview build by its website: the lead with that website's domain, or a new one. New leads
 * come in as requests (a founder or Claude asked for them, so they get the request email, not the cold one).
 */
export async function queueSite(input: QueueSiteInput): Promise<QueueSiteResult> {
  const database = await db();
  const domain = domainOf(input.website);
  const rows = await database.select().from(businesses);
  let lead = rows.find((row) => domain && domainOf(row.website) === domain) ?? null;
  const createdLead = !lead;
  if (!lead) {
    const businessName = input.businessName?.trim() || nameFromDomain(domain);
    [lead] = await database
      .insert(businesses)
      .values({
        slug: uniqueSlug(businessName, new Set(rows.map((row) => row.slug))),
        linkCode: newLinkCode(),
        businessName,
        website: input.website,
        source: "request",
        priceArm: INBOUND_PRICE_ARM,
        foundDate: new Date().toISOString().slice(0, 10),
        note: `Queued by ${input.requestedBy}.`,
      })
      .returning();
    await record(input.requestedBy, "added a lead", { businessId: lead.id, detail: input.website });
  }
  const { job, created } = await requestPreview(lead, input.requestedBy, input.note ?? "");
  return { lead, job, createdLead, createdJob: created };
}
