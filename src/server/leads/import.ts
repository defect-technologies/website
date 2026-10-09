import "server-only";
import { randomBytes } from "node:crypto";
import { PRICE_ARMS } from "@/lib/stages";
import { db } from "../db/client";
import { businesses } from "../db/schema";
import { domainOf } from "../mail/mime";
import { blockedDomains } from "./businesses";
import { parseCsv } from "./csv";

type NewBusiness = typeof businesses.$inferInsert;
type Existing = { placeIds: Set<string>; websites: Set<string>; slugs: Set<string>; armCounts: Map<string, number[]> };

const CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** The short code in a preview link, defect.tech/p/<code>. */
export function newLinkCode(): string {
  return [...randomBytes(8)].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "business"
  );
}

function uniqueSlug(name: string, taken: Set<string>) {
  const base = slugify(name);
  let slug = base;
  for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
  taken.add(slug);
  return slug;
}

function intOrNull(value: string) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : null;
}

/** Alternates $59 and $79 within each niche by giving each new email-ready lead the arm with fewer leads so far. */
function assignArm(row: Record<string, string>, existing: Existing): number | null {
  const given = intOrNull(row.price_arm ?? "");
  if (given && (PRICE_ARMS as readonly number[]).includes(given)) return given;
  if (row.lead_type !== "email-ready") return null;
  const counts = existing.armCounts.get(row.niche) ?? [0, 0];
  const index = counts[0] <= counts[1] ? 0 : 1;
  counts[index] += 1;
  existing.armCounts.set(row.niche, counts);
  return PRICE_ARMS[index];
}

function isDuplicate(row: Record<string, string>, existing: Existing) {
  const website = domainOf(row.website ?? "");
  return (row.place_id && existing.placeIds.has(row.place_id)) || (website && existing.websites.has(website));
}

/** Copies these lead finder columns across unchanged, as column name to business field. */
const TEXT_COLUMNS = {
  website: "website",
  instagram: "instagram",
  platform: "platform",
  outdated_signals: "outdatedSignals",
  problem_summary: "problemSummary",
  lead_type: "leadType",
  niche: "niche",
  area: "area",
  found_date: "foundDate",
  note: "note",
} as const;

function textColumns(column: (name: string) => string) {
  return Object.fromEntries(Object.entries(TEXT_COLUMNS).map(([name, field]) => [field, column(name)]));
}

function toBusiness(row: Record<string, string>, existing: Existing, blocked: Set<string>): NewBusiness {
  const column = (name: string) => row[name] ?? "";
  const optedOut = blocked.has(domainOf(column("email")));
  return {
    ...textColumns(column),
    placeId: column("place_id") || null,
    slug: uniqueSlug(column("business_name"), existing.slugs),
    linkCode: newLinkCode(),
    businessName: column("business_name"),
    email: column("email").toLowerCase(),
    copyrightYear: intOrNull(column("copyright_year")),
    outdatedScore: intOrNull(column("outdated_score")) ?? 0,
    priceArm: optedOut ? null : assignArm(row, existing),
    stage: optedOut ? "opted_out" : "new",
  };
}

async function loadExisting(): Promise<Existing> {
  const rows = await (await db())
    .select({ placeId: businesses.placeId, website: businesses.website, slug: businesses.slug, niche: businesses.niche, arm: businesses.priceArm })
    .from(businesses);
  const existing: Existing = { placeIds: new Set(), websites: new Set(), slugs: new Set(), armCounts: new Map() };
  for (const row of rows) {
    if (row.placeId) existing.placeIds.add(row.placeId);
    existing.websites.add(domainOf(row.website));
    existing.slugs.add(row.slug);
    const counts = existing.armCounts.get(row.niche) ?? [0, 0];
    if (row.arm) counts[PRICE_ARMS.indexOf(row.arm as 59 | 79)] += 1;
    existing.armCounts.set(row.niche, counts);
  }
  existing.websites.delete("");
  return existing;
}

function remember(row: NewBusiness, existing: Existing) {
  if (row.placeId) existing.placeIds.add(row.placeId);
  const website = domainOf(row.website ?? "");
  if (website) existing.websites.add(website);
}

/** Adds the lead finder's leads.csv. Businesses already here (by place ID or website) are skipped, as the lead finder does. */
export async function importLeads(csv: string): Promise<{ added: number; skipped: number }> {
  const rows = parseCsv(csv).filter((row) => row.business_name);
  const existing = await loadExisting();
  const blocked = await blockedDomains();
  const fresh: NewBusiness[] = [];
  for (const row of rows) {
    if (isDuplicate(row, existing)) continue;
    const business = toBusiness(row, existing, blocked);
    remember(business, existing);
    fresh.push(business);
  }
  if (fresh.length > 0) await (await db()).insert(businesses).values(fresh);
  return { added: fresh.length, skipped: rows.length - fresh.length };
}
