import "server-only";
import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { actorLabel, type Bot, type FlagStatus } from "@/lib/bots";
import { FIXERS, FLAG_NEEDS, FLAG_TOPICS, headlineProblem, type FlagTopic } from "@/lib/flags";
import { record } from "../activity";
import { db } from "../db/client";
import { activity, businesses, flags, type BotKey, type Flag } from "../db/schema";
import { businessById } from "../leads/businesses";
import { alertFounders } from "../flags/notify";
import { actorOf, BotError } from "./http";

const OLD_SHAPE_HELP =
  'Flags have a new shape: {"headline": "<one plain sentence, 80 characters at most>", "needs": "decision" | "fix" | "nothing", "ask": "<the question, or the step to take>", "options": ["<answer>", "<answer>"], "fixer": "either" | "brendan" | "boris" | "claude", "topic": "<topic>", "urgent": false, "details": "<what happened and what you did>", "leadId": "<id>", "link": "<thread link>"}.';

export const FlagBody = z
  .object({
    headline: z
      .string({ error: OLD_SHAPE_HELP })
      .trim()
      .min(1)
      .superRefine((headline, context) => {
        const problem = headlineProblem(headline);
        if (problem) context.addIssue({ code: "custom", message: `Rewrite the headline: ${problem}. Say what's wrong the way you'd tell a business owner.` });
      }),
    needs: z.enum(FLAG_NEEDS),
    ask: z.string().trim().max(300).default(""),
    options: z.array(z.string().trim().min(1).max(60)).max(3).default([]),
    fixer: z.enum(FIXERS).default("either"),
    topic: z.enum(FLAG_TOPICS).default("other"),
    urgent: z.boolean().default(false),
    details: z.string().trim().max(4000).default(""),
    leadId: z.uuid().optional(),
    link: z.url().optional(),
  })
  .superRefine((flag, context) => {
    if (flag.needs === "decision" && flag.options.length < 2) context.addIssue({ code: "custom", path: ["options"], message: "A decision needs 2 or 3 answers for the founder to pick from." });
    if (flag.needs !== "nothing" && !flag.ask) context.addIssue({ code: "custom", path: ["ask"], message: "Say what you need: the question for a decision, or the step to take for a fix." });
  });
export type NewFlag = z.infer<typeof FlagBody>;

const priorityOf = (flag: Pick<NewFlag, "needs" | "urgent">) => (flag.urgent ? "urgent" : flag.needs === "nothing" ? "fyi" : "review");

const stamp = (by: string) => `${actorLabel(by)}, ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" })}`;

async function openFlagOn(businessId: string, topic: FlagTopic): Promise<Flag | null> {
  const [flag] = await (await db())
    .select()
    .from(flags)
    .where(and(eq(flags.businessId, businessId), eq(flags.topic, topic), eq(flags.status, "open")))
    .orderBy(desc(flags.at))
    .limit(1);
  return flag ?? null;
}

/** The newest report says what's true now, so it replaces the card's text; the earlier ones stay in details. */
async function mergeInto(existing: Flag, flag: NewFlag, by: string): Promise<Flag> {
  const urgent = existing.priority === "urgent" || flag.urgent;
  const [merged] = await (await db())
    .update(flags)
    .set({
      headline: flag.headline,
      needs: flag.needs,
      ask: flag.ask,
      options: flag.options,
      fixer: flag.fixer,
      priority: priorityOf({ needs: flag.needs, urgent }),
      details: `${existing.details}\n\n${stamp(by)}:\n${flag.details}`.trim(),
      link: flag.link ?? existing.link,
      reports: existing.reports + 1,
      updatedAt: new Date(),
    })
    .where(eq(flags.id, existing.id))
    .returning();
  return merged;
}

async function insertFlag(bot: Bot, businessId: string | null, flag: NewFlag, by: string): Promise<Flag> {
  const [created] = await (await db())
    .insert(flags)
    .values({
      bot,
      businessId,
      priority: priorityOf(flag),
      headline: flag.headline,
      needs: flag.needs,
      ask: flag.ask,
      options: flag.options,
      fixer: flag.fixer,
      topic: flag.topic,
      details: flag.details ? `${stamp(by)}:\n${flag.details}` : "",
      link: flag.link ?? "",
    })
    .returning();
  return created;
}

/** Opens a card, or adds to the open one on the same lead and topic. Urgent cards email both founders. */
export async function raiseFlag(bot: Bot, businessId: string | null, flag: NewFlag): Promise<{ flag: Flag; merged: boolean }> {
  const by = actorOf({ bot } as BotKey);
  const existing = businessId && flag.topic !== "other" ? await openFlagOn(businessId, flag.topic) : null;
  const saved = existing ? await mergeInto(existing, flag, by) : await insertFlag(bot, businessId, flag, by);
  await record(by, existing ? "added to a flag" : "flagged", { businessId, detail: flag.headline, priority: saved.priority as "urgent" | "review" | "fyi" });
  if (saved.priority === "urgent" && existing?.priority !== "urgent") await alertFounders(saved).catch((error) => console.error("[flags] alert", error));
  return { flag: saved, merged: Boolean(existing) };
}

export async function createFlag(key: BotKey, body: NewFlag) {
  const lead = body.leadId ? await businessById(body.leadId) : null;
  if (body.leadId && !lead) throw new BotError(404, "No lead has that ID. Leave leadId out if the flag isn't about a lead.");
  const { flag, merged } = await raiseFlag(key.bot as Bot, lead?.id ?? null, body);
  return { ok: true, flagId: flag.id, merged, ...(merged ? { note: "Added to the open flag on this lead and topic." } : {}) };
}

/** Closes the lead's open flags on these topics because what they were about has cleared. */
export async function closeFlagsOn(businessId: string, topics: FlagTopic[], reason: string, by: string) {
  const closed = await (await db())
    .update(flags)
    .set({ status: "closed", note: reason, reviewer: by, resolvedAt: new Date() })
    .where(and(eq(flags.businessId, businessId), inArray(flags.topic, topics), eq(flags.status, "open")))
    .returning({ id: flags.id });
  if (closed.length) await record(by, "closed a flag", { businessId, detail: reason });
}

export const CloseBody = z.object({ reason: z.string().trim().min(1).max(500) });

/** POST /flags/:id/close: a bot closes its own flag (the Overseer, any flag) once it no longer needs a founder. */
export async function closeFlagForBot(key: BotKey, id: string, { reason }: z.infer<typeof CloseBody>) {
  const { flag } = await flagForBot(key, id);
  if (flag.status !== "open") throw new BotError(409, `That flag is already ${flag.status}.`);
  await resolveFlag(flag.id, "closed", reason, actorOf(key));
  return { ok: true };
}

const isOverseer = (key: BotKey) => (key.bot as Bot) === "overseer";

/** Each bot reads its own flags (to pick up a founder's answer); the Overseer reads all of them. */
export async function listFlags(key: BotKey, status?: FlagStatus) {
  const conditions = and(isOverseer(key) ? undefined : eq(flags.bot, key.bot), status ? eq(flags.status, status) : undefined);
  const rows = await (await db()).select().from(flags).where(conditions).orderBy(desc(flags.at)).limit(200);
  return { flags: rows };
}

export async function flagForBot(key: BotKey, id: string): Promise<{ flag: Flag }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new BotError(404, "No flag has that ID.");
  const [flag] = await (await db()).select().from(flags).where(eq(flags.id, id));
  if (!flag || (!isOverseer(key) && flag.bot !== key.bot)) throw new BotError(404, "No flag of yours has that ID.");
  return { flag };
}

export async function activitySince(key: BotKey, since: Date) {
  if (!isOverseer(key)) throw new BotError(403, "Only the Overseer reads the whole activity log.");
  const rows = await (await db())
    .select({ at: activity.at, actor: activity.actor, action: activity.action, detail: activity.detail, priority: activity.priority, business: businesses.businessName, leadId: activity.businessId })
    .from(activity)
    .leftJoin(businesses, eq(activity.businessId, businesses.id))
    .where(gte(activity.at, since))
    .orderBy(desc(activity.at))
    .limit(500);
  return { activity: rows };
}

export type FlagRow = { flag: Flag; businessName: string | null };

/** Open cards that need a founder: urgent first, then oldest first. FYIs wait for the digest. */
export async function openFlags(): Promise<FlagRow[]> {
  return (await db())
    .select({ flag: flags, businessName: businesses.businessName })
    .from(flags)
    .leftJoin(businesses, eq(flags.businessId, businesses.id))
    .where(and(eq(flags.status, "open"), ne(flags.needs, "nothing")))
    .orderBy(sql`${flags.priority} = 'urgent' desc`, flags.at);
}

export async function openFyis(): Promise<FlagRow[]> {
  return (await db())
    .select({ flag: flags, businessName: businesses.businessName })
    .from(flags)
    .leftJoin(businesses, eq(flags.businessId, businesses.id))
    .where(and(eq(flags.status, "open"), eq(flags.needs, "nothing")))
    .orderBy(flags.at);
}

export async function resolvedFlags(limit = 20): Promise<FlagRow[]> {
  return (await db())
    .select({ flag: flags, businessName: businesses.businessName })
    .from(flags)
    .leftJoin(businesses, eq(flags.businessId, businesses.id))
    .where(ne(flags.status, "open"))
    .orderBy(desc(flags.resolvedAt))
    .limit(limit);
}

export async function openFlagCount(): Promise<number> {
  const [row] = await (await db())
    .select({ count: sql<number>`count(*)::int` })
    .from(flags)
    .where(and(eq(flags.status, "open"), ne(flags.needs, "nothing")));
  return row?.count ?? 0;
}

export async function resolveFlag(id: string, status: Exclude<FlagStatus, "open">, note: string, reviewer: string) {
  const [flag] = await (await db()).update(flags).set({ status, note, reviewer, resolvedAt: new Date() }).where(eq(flags.id, id)).returning();
  if (flag) await record(reviewer, `${status} a flag`, { businessId: flag.businessId, detail: note || flag.headline });
  return flag ?? null;
}
