import "server-only";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { stagesBefore } from "@/lib/stages";
import { db } from "../db/client";
import { businesses, doNotContact, type Business, type Stage } from "../db/schema";
import { domainOf } from "../mail/mime";

export async function businessById(id: string): Promise<Business | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await (await db()).select().from(businesses).where(eq(businesses.id, id));
  return row ?? null;
}

/** Moves a lead forward to `stage`, and never backward: a late click can't undo a reply. */
export async function advanceStage(id: string, stage: Stage) {
  const earlier = stagesBefore(stage);
  if (earlier.length === 0) return;
  await (await db())
    .update(businesses)
    .set({ stage, updatedAt: new Date() })
    .where(and(eq(businesses.id, id), inArray(businesses.stage, earlier)));
}

export async function updateBusiness(id: string, fields: Partial<Business>) {
  await (await db())
    .update(businesses)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(businesses.id, id));
}

export async function blockedDomains(): Promise<Set<string>> {
  const rows = await (await db()).select({ domain: doNotContact.domain }).from(doNotContact);
  return new Set(rows.map((row) => row.domain));
}

/** Opt-outs are permanent: the lead, and everyone else at that email domain. */
export async function optOut(business: Business, reason: string) {
  const domain = domainOf(business.email);
  const database = await db();
  if (domain) await database.insert(doNotContact).values({ domain, reason }).onConflictDoNothing();
  await updateBusiness(business.id, { stage: "opted_out" });
}

export type LeadFilter = { stage?: Stage | "all"; niche?: string; arm?: number | null };

export async function listBusinesses({ stage = "all", niche = "", arm = null }: LeadFilter = {}) {
  const conditions = [
    stage === "all" ? undefined : eq(businesses.stage, stage),
    niche ? eq(businesses.niche, niche) : undefined,
    arm ? eq(businesses.priceArm, arm) : undefined,
  ].filter(Boolean);
  return (await db())
    .select()
    .from(businesses)
    .where(and(...conditions))
    .orderBy(desc(businesses.outdatedScore), businesses.businessName)
    .limit(500);
}

export async function stageCounts(): Promise<Record<string, number>> {
  const rows = await (await db())
    .select({ stage: businesses.stage, count: sql<number>`count(*)::int` })
    .from(businesses)
    .groupBy(businesses.stage);
  return Object.fromEntries(rows.map((row) => [row.stage, row.count]));
}

export async function niches(): Promise<string[]> {
  const rows = await (await db()).selectDistinct({ niche: businesses.niche }).from(businesses).where(isNotNull(businesses.niche));
  return rows.map((row) => row.niche).filter(Boolean).sort();
}

export type ArmFunnel = { arm: number; leads: number; sent: number; clicked: number; replied: number; paid: number };

/** How far each price arm's leads got, counting a lead at every step it has reached. */
export async function funnelByArm(): Promise<ArmFunnel[]> {
  const reached = (column: unknown) => sql<number>`count(*) filter (where ${column} is not null)::int`;
  const rows = await (await db())
    .select({
      arm: businesses.priceArm,
      leads: sql<number>`count(*)::int`,
      sent: reached(businesses.firstSentAt),
      clicked: reached(businesses.clickedAt),
      replied: reached(businesses.repliedAt),
      paid: reached(businesses.paidAt),
    })
    .from(businesses)
    .where(isNotNull(businesses.priceArm))
    .groupBy(businesses.priceArm);
  return rows.map((row) => ({ ...row, arm: Number(row.arm) })).sort((a, b) => a.arm - b.arm);
}
