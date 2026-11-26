import "server-only";
import { eq } from "drizzle-orm";
import { DEFAULT_RESEARCH, searchKey, type ResearchSettings, type Search } from "@/lib/research";
import { db } from "./db/client";
import { settings } from "./db/schema";
import { addLeadRows } from "./leads/import";
import type { ProspectInput } from "./prospects";

const RESEARCH_KEY = "research";

export async function researchSettings(): Promise<ResearchSettings> {
  const [row] = await (await db()).select().from(settings).where(eq(settings.key, RESEARCH_KEY));
  return { ...DEFAULT_RESEARCH, ...((row?.value as Partial<ResearchSettings>) ?? {}) };
}

export async function updateResearchSettings(patch: Partial<ResearchSettings>, updatedBy: string): Promise<ResearchSettings> {
  const value = { ...(await researchSettings()), ...patch };
  const now = new Date();
  await (await db())
    .insert(settings)
    .values({ key: RESEARCH_KEY, value, updatedBy, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy, updatedAt: now } });
  return value;
}

/** The nightly job reports the searches it ran, so the next night starts with the others. */
export async function markSearched(searches: Search[], now = new Date()): Promise<void> {
  const current = await researchSettings();
  const searched = { ...current.searched, ...Object.fromEntries(searches.map((search) => [searchKey(search), now.toISOString()])) };
  await updateResearchSettings({ searched }, "lead finder");
}

/** A prospect in the lead finder's CSV columns, as the CSV import reads them. */
function leadRow(input: ProspectInput): Record<string, string> {
  return {
    place_id: input.place_id,
    business_name: input.business_name,
    website: input.website,
    email: input.email,
    instagram: input.instagram,
    platform: input.platform,
    copyright_year: input.copyright_year?.toString() ?? "",
    outdated_score: input.outdated_score.toString(),
    outdated_signals: input.signals.join(","),
    problem_summary: input.problem_summary,
    lead_type: input.lead_type,
    niche: input.niche === "manual" ? "" : input.niche,
    area: input.area,
    found_date: new Date().toISOString().slice(0, 10),
  };
}

/**
 * With the nightly search on, every audited business that needs a redesign and shows an email becomes a lead, and the
 * runner builds it on its own. The lead finder already left out online stores, chains and directories.
 */
export async function addLeadsFromProspects(inputs: ProspectInput[]): Promise<number> {
  if (!(await researchSettings()).enabled) return 0;
  const ready = inputs.filter((input) => input.lead_type === "email-ready" && input.email && input.website);
  if (!ready.length) return 0;
  return (await addLeadRows(ready.map(leadRow))).added;
}
