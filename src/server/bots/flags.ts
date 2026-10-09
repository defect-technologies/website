import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { FLAG_PRIORITIES, type Bot, type FlagStatus } from "@/lib/bots";
import { record } from "../activity";
import { db } from "../db/client";
import { activity, businesses, flags, type BotKey, type Flag } from "../db/schema";
import { businessById } from "../leads/businesses";
import { actorOf, BotError } from "./http";

export const FlagBody = z.object({
  priority: z.enum(FLAG_PRIORITIES),
  leadId: z.uuid().optional(),
  whatHappened: z.string().trim().min(1).max(1000),
  whatBotDid: z.string().trim().min(1).max(500),
  why: z.string().trim().min(1).max(500),
  link: z.url().optional(),
});

export async function createFlag(key: BotKey, body: z.infer<typeof FlagBody>) {
  const lead = body.leadId ? await businessById(body.leadId) : null;
  if (body.leadId && !lead) throw new BotError(404, "No lead has that ID. Leave leadId out if the flag isn't about a lead.");
  const [flag] = await (await db())
    .insert(flags)
    .values({ bot: key.bot, businessId: lead?.id ?? null, priority: body.priority, whatHappened: body.whatHappened, whatBotDid: body.whatBotDid, why: body.why, link: body.link ?? "" })
    .returning();
  await record(actorOf(key), "flagged", { businessId: lead?.id ?? null, detail: body.whatHappened, priority: body.priority });
  return { ok: true, flagId: flag.id };
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

/** Open flags for the admin's review queue, most pressing first. */
export async function openFlags() {
  const priorityOrder = sql`case ${flags.priority} when 'urgent' then 0 when 'review' then 1 else 2 end`;
  return (await db())
    .select({ flag: flags, businessName: businesses.businessName })
    .from(flags)
    .leftJoin(businesses, eq(flags.businessId, businesses.id))
    .where(eq(flags.status, "open"))
    .orderBy(priorityOrder, flags.at);
}

export async function resolvedFlags(limit = 20) {
  return (await db())
    .select({ flag: flags, businessName: businesses.businessName })
    .from(flags)
    .leftJoin(businesses, eq(flags.businessId, businesses.id))
    .where(inArray(flags.status, ["answered", "approved", "reversed"]))
    .orderBy(desc(flags.resolvedAt))
    .limit(limit);
}

export async function openFlagCount(): Promise<number> {
  const [row] = await (await db()).select({ count: sql<number>`count(*)::int` }).from(flags).where(eq(flags.status, "open"));
  return row?.count ?? 0;
}

export async function resolveFlag(id: string, status: Exclude<FlagStatus, "open">, note: string, reviewer: string) {
  const [flag] = await (await db()).update(flags).set({ status, note, reviewer, resolvedAt: new Date() }).where(eq(flags.id, id)).returning();
  if (flag) await record(reviewer, `${status} a flag`, { businessId: flag.businessId, detail: note || flag.whatHappened });
  return flag ?? null;
}
