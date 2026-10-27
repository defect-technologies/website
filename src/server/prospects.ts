import "server-only";
import { and, asc, count, desc, eq, gte, ilike, isNotNull, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db/client";
import { businesses, prospects, type Prospect } from "./db/schema";
import { domainOf } from "./mail/mime";

const text = (max: number) => z.string().trim().max(max).catch("").default("");
const links = z.array(z.string().trim().max(500)).max(50).catch([]).default([]);
const whole = z.number().int().min(0).nullable().catch(null).default(null);

/** One audited business as lead_finder.py posts it. Only place_id comes from Google. */
export const ProspectInput = z.object({
  place_id: text(200),
  business_name: text(300),
  website: text(500),
  niche: text(120),
  area: text(120),
  platform: text(80),
  email: text(320),
  emails: z.array(z.string().trim().max(320)).max(20).catch([]).default([]),
  instagram: text(120),
  phone: text(60),
  address: text(400),
  social_links: z.record(z.string().max(40), z.string().max(500)).catch({}).default({}),
  review_links: links,
  booking_links: links,
  ordering_links: links,
  page_title: text(500),
  meta_description: text(1000),
  copyright_year: z.number().int().min(1990).max(2100).nullable().catch(null).default(null),
  reachable: z.boolean().catch(false).default(false),
  site_score: z.number().int().min(0).max(100).nullable().catch(null).default(null),
  outdated_score: z.number().int().min(0).catch(0).default(0),
  signals: z.array(z.string().trim().max(60)).max(100).catch([]).default([]),
  problem_summary: text(2000),
  lead_type: text(40),
  page_count: whole,
  server_ms: whole,
  load_ms: whole,
  page_bytes: whole,
  audit: z.record(z.string(), z.unknown()).catch({}).default({}),
});
export type ProspectInput = z.infer<typeof ProspectInput>;

export const ProspectBatch = z.object({ prospects: z.array(z.unknown()).min(1).max(200) });

/** Who a row is: its place ID when Google found it, else its website's domain. */
export function prospectKey(input: Pick<ProspectInput, "place_id" | "website">): string | null {
  if (input.place_id) return `place:${input.place_id}`;
  const domain = domainOf(input.website);
  return domain ? `site:${domain}` : null;
}

function toRow(input: ProspectInput, key: string, now: Date): typeof prospects.$inferInsert {
  return {
    key,
    placeId: input.place_id || null,
    businessName: input.business_name,
    website: input.website,
    domain: domainOf(input.website),
    niche: input.niche === "manual" ? "" : input.niche,
    area: input.area,
    platform: input.platform,
    email: input.email,
    emails: input.emails,
    instagram: input.instagram,
    phone: input.phone,
    address: input.address,
    socialLinks: input.social_links,
    reviewLinks: input.review_links,
    bookingLinks: input.booking_links,
    orderingLinks: input.ordering_links,
    pageTitle: input.page_title,
    metaDescription: input.meta_description,
    copyrightYear: input.copyright_year,
    reachable: input.reachable,
    siteScore: input.site_score,
    outdatedScore: input.outdated_score,
    signals: [...new Set(input.signals.filter(Boolean))],
    problemSummary: input.problem_summary,
    leadType: input.lead_type,
    pageCount: input.page_count,
    serverMs: input.server_ms,
    loadMs: input.load_ms,
    pageBytes: input.page_bytes,
    audit: input.audit,
    updatedAt: now,
  };
}

/** A later run without a niche or area (an --urls-file run) keeps the one already known. */
const keepUnlessGiven = (column: string) => sql.raw(`coalesce(nullif(excluded."${column}", ''), "prospects"."${column}")`);

/** Everything a fresh audit replaces. The niche and area are kept unless given, and found_at never changes. */
const REFRESHED = [
  "placeId", "businessName", "website", "domain", "platform", "email", "emails", "instagram", "phone", "address",
  "socialLinks", "reviewLinks", "bookingLinks", "orderingLinks", "pageTitle", "metaDescription", "copyrightYear",
  "reachable", "siteScore", "outdatedScore", "signals", "problemSummary", "leadType", "pageCount", "serverMs",
  "loadMs", "pageBytes", "audit", "updatedAt",
] as const satisfies (keyof typeof prospects.$inferInsert)[];

const refreshed = Object.fromEntries(REFRESHED.map((field) => [field, sql.raw(`excluded."${prospects[field].name}"`)]));

/**
 * Adds or refreshes audited businesses, then links any that match a lead. Rows with
 * neither a place ID nor a website are skipped. A business seen twice in one batch
 * keeps its last entry.
 */
export async function upsertProspects(inputs: ProspectInput[]): Promise<{ saved: number; skipped: number; linked: number }> {
  const now = new Date();
  const byKey = new Map<string, typeof prospects.$inferInsert>();
  for (const input of inputs) {
    const key = prospectKey(input);
    if (key) byKey.set(key, toRow(input, key, now));
  }
  const rows = [...byKey.values()];
  const database = await db();
  if (rows.length > 0) {
    await database
      .insert(prospects)
      .values(rows)
      .onConflictDoUpdate({ target: prospects.key, set: { ...refreshed, niche: keepUnlessGiven("niche"), area: keepUnlessGiven("area") } });
  }
  return { saved: rows.length, skipped: inputs.length - rows.length, linked: await linkProspectsToLeads() };
}

/** Points prospects at the lead made from them, by place ID or website domain. Returns how many were linked. */
export async function linkProspectsToLeads(): Promise<number> {
  const linked = await (await db()).execute(sql`
    update prospects set business_id = businesses.id
    from businesses
    where prospects.business_id is null and (
      (prospects.place_id is not null and prospects.place_id = businesses.place_id)
      or (prospects.domain <> '' and prospects.domain = lower(regexp_replace(regexp_replace(businesses.website, '^[a-z]+://(www\\.)?', '', 'i'), '[/:?#].*$', '')))
    )
    returning prospects.id`);
  const rows = (linked as unknown as { rows?: unknown[] }).rows ?? (linked as unknown as unknown[]);
  return Array.isArray(rows) ? rows.length : 0;
}

export const PROSPECT_SORTS = [
  ["newest", "Newest first"],
  ["worst", "Lowest score first"],
  ["best", "Highest score first"],
] as const satisfies readonly [string, string][];
export type ProspectSort = (typeof PROSPECT_SORTS)[number][0];

export type ProspectFilters = {
  q: string;
  niche: string;
  area: string;
  platform: string;
  signal: string;
  minScore: number | null;
  maxScore: number | null;
  hasEmail: boolean;
  lead: "" | "yes" | "no";
  sort: ProspectSort;
  page: number;
};

export const PROSPECTS_PER_PAGE = 50;

function where(filters: ProspectFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [];
  if (filters.q) {
    const pattern = `%${filters.q.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
    conditions.push(
      or(
        ilike(prospects.businessName, pattern),
        ilike(prospects.website, pattern),
        ilike(prospects.email, pattern),
        ilike(prospects.pageTitle, pattern),
        ilike(prospects.metaDescription, pattern),
        ilike(prospects.address, pattern),
        ilike(prospects.phone, pattern),
        ilike(prospects.instagram, pattern),
        ilike(prospects.problemSummary, pattern),
      ),
    );
  }
  if (filters.niche) conditions.push(eq(prospects.niche, filters.niche));
  if (filters.area) conditions.push(eq(prospects.area, filters.area));
  if (filters.platform) conditions.push(eq(prospects.platform, filters.platform));
  if (filters.signal) conditions.push(sql`${prospects.signals} @> array[${filters.signal}]::text[]`);
  if (filters.minScore !== null) conditions.push(gte(prospects.siteScore, filters.minScore));
  if (filters.maxScore !== null) conditions.push(lte(prospects.siteScore, filters.maxScore));
  if (filters.hasEmail) conditions.push(ne(prospects.email, ""));
  if (filters.lead === "yes") conditions.push(isNotNull(prospects.businessId));
  if (filters.lead === "no") conditions.push(isNull(prospects.businessId));
  return and(...conditions);
}

const ORDER = {
  newest: [desc(prospects.foundAt), desc(prospects.updatedAt)],
  worst: [sql`${prospects.siteScore} asc nulls last`, desc(prospects.foundAt)],
  best: [sql`${prospects.siteScore} desc nulls last`, desc(prospects.foundAt)],
} satisfies Record<ProspectSort, unknown[]>;

export async function searchProspects(filters: ProspectFilters): Promise<{ rows: Prospect[]; total: number }> {
  const database = await db();
  const condition = where(filters);
  const [rows, [total]] = await Promise.all([
    database
      .select()
      .from(prospects)
      .where(condition)
      .orderBy(...ORDER[filters.sort])
      .limit(PROSPECTS_PER_PAGE)
      .offset((filters.page - 1) * PROSPECTS_PER_PAGE),
    database.select({ count: count() }).from(prospects).where(condition),
  ]);
  return { rows, total: total?.count ?? 0 };
}

/** The values each filter can take, from what's been collected so far. */
export async function prospectFacets() {
  const database = await db();
  const distinct = async (column: typeof prospects.niche | typeof prospects.area | typeof prospects.platform) =>
    (await database.selectDistinct({ value: column }).from(prospects).where(ne(column, "")).orderBy(asc(column))).map((row) => row.value);
  const [niches, areas, platforms, signals] = await Promise.all([
    distinct(prospects.niche),
    distinct(prospects.area),
    distinct(prospects.platform),
    database.execute(sql`select distinct unnest(signals) as value from prospects order by 1`),
  ]);
  const signalRows = ((signals as unknown as { rows?: { value: string }[] }).rows ?? (signals as unknown as { value: string }[])) as { value: string }[];
  return { niches, areas, platforms, signals: signalRows.map((row) => row.value) };
}

/** Every prospect with a website, a page at a time, for founders' tools and Claude (GET /api/engine/prospects). */
export async function prospectWebsites(offset: number, limit: number) {
  return (await db())
    .select({ id: prospects.id, businessName: prospects.businessName, website: prospects.website, platform: prospects.platform, siteScore: prospects.siteScore, leadType: prospects.leadType, isLead: isNotNull(prospects.businessId) })
    .from(prospects)
    .where(ne(prospects.website, ""))
    .orderBy(desc(prospects.foundAt))
    .limit(limit)
    .offset(offset);
}

export const ProspectRenames = z.object({
  names: z.array(z.object({ id: z.uuid(), businessName: z.string().trim().min(1).max(200) })).min(1).max(500),
});

/**
 * Corrects audited businesses' names, and the lead made from one while it's still new (never contacted, so no owner
 * has seen the old name). The lead finder named some businesses after a city or a placeholder ('Los Angeles, CA',
 * 'MySite'); a refreshed audit fixes the name too, but re-auditing would also replace everything else.
 */
export async function renameProspects(names: { id: string; businessName: string }[]): Promise<{ prospects: number; leads: number; renamed: { from: string; to: string; businessId: string | null }[] }> {
  const database = await db();
  const renamed: { from: string; to: string; businessId: string | null }[] = [];
  let leads = 0;
  for (const { id, businessName } of names) {
    const [before] = await database.select({ name: prospects.businessName, businessId: prospects.businessId }).from(prospects).where(eq(prospects.id, id));
    if (!before || before.name === businessName) continue;
    await database.update(prospects).set({ businessName, updatedAt: new Date() }).where(eq(prospects.id, id));
    if (before.businessId) {
      const changed = await database.update(businesses).set({ businessName }).where(and(eq(businesses.id, before.businessId), eq(businesses.stage, "new"))).returning({ id: businesses.id });
      leads += changed.length;
    }
    renamed.push({ from: before.name, to: businessName, businessId: before.businessId });
  }
  return { prospects: renamed.length, leads, renamed };
}
