import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { record } from "../activity";
import { db } from "../db/client";
import { businesses, flags, type Flag } from "../db/schema";
import { fixPrompt } from "./fixPrompt";

/**
 * Flags assigned to Claude are worked on by a Claude Code session on the studio's machine, which polls for them
 * (engine/ops/flag_worker.py). A claimed flag carries reviewer "claude" and the time it started in its note, so the
 * review queue can say Claude is on it. No migration: both are existing columns.
 */
export const CLAUDE = "claude";

export interface ClaudeFlag {
  id: string;
  headline: string;
  ask: string;
  topic: string;
  link: string;
  details: string;
  lead: { id: string; slug: string; name: string; website: string; stage: string } | null;
  prompt: string;
}

/** Open flags assigned to Claude that no session has claimed yet, oldest first. */
export async function waitingClaudeFlags(): Promise<ClaudeFlag[]> {
  const rows = await (await db())
    .select({ flag: flags, lead: businesses })
    .from(flags)
    .leftJoin(businesses, eq(flags.businessId, businesses.id))
    .where(and(eq(flags.status, "open"), eq(flags.fixer, CLAUDE), ne(flags.reviewer, CLAUDE)))
    .orderBy(flags.at);
  return rows.map(({ flag, lead }) => ({
    id: flag.id,
    headline: flag.headline || flag.whatHappened,
    ask: flag.ask,
    topic: flag.topic,
    link: flag.link,
    details: flag.details,
    lead: lead ? { id: lead.id, slug: lead.slug, name: lead.businessName, website: lead.website, stage: lead.stage } : null,
    prompt: fixPrompt(flag, lead?.businessName ?? null),
  }));
}

/** Marks a flag as Claude's. False when it's gone, resolved or already claimed. */
export async function claimClaudeFlag(id: string): Promise<boolean> {
  const [claimed] = await (await db())
    .update(flags)
    .set({ reviewer: CLAUDE, note: `Claude started on this ${new Date().toISOString()}.`, updatedAt: new Date() })
    .where(and(eq(flags.id, id), eq(flags.status, "open"), ne(flags.reviewer, CLAUDE)))
    .returning({ id: flags.id, businessId: flags.businessId });
  if (!claimed) return false;
  await record(CLAUDE, "started on a flag", { businessId: claimed.businessId, detail: id });
  return true;
}

export type ClaudeOutcome = "fixed" | "needs_founder";

/** Claude's result: fixed closes the flag; needs_founder hands it back to either founder with Claude's reason. */
export async function reportClaudeFlag(id: string, outcome: ClaudeOutcome, summary: string): Promise<Flag | null> {
  const values =
    outcome === "fixed"
      ? { status: "fixed" as const, note: summary, reviewer: CLAUDE, resolvedAt: new Date(), updatedAt: new Date() }
      : { fixer: "either" as const, reviewer: "", note: `Claude handed this back: ${summary}`, updatedAt: new Date() };
  const [flag] = await (await db()).update(flags).set(values).where(eq(flags.id, id)).returning();
  if (flag) await record(CLAUDE, outcome === "fixed" ? "fixed a flag" : "handed a flag back", { businessId: flag.businessId, detail: summary.slice(0, 500) });
  return flag ?? null;
}

/** A founder hands any open flag to Claude from the review queue. */
export async function handFlagToClaude(id: string): Promise<void> {
  await (await db()).update(flags).set({ fixer: CLAUDE, reviewer: "", updatedAt: new Date() }).where(and(eq(flags.id, id), eq(flags.status, "open")));
}
