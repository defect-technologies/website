import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { BOT_LABEL, BOTS, type Bot } from "@/lib/bots";
import { botWatchChanges, recoveredEmail, stoppedEmail } from "@/lib/botWatch";
import { record } from "../activity";
import { db } from "../db/client";
import { activity, botKeys } from "../db/schema";
import { env } from "../env";
import { emailFounders } from "../flags/notify";

const WATCH_ACTOR = "admin";
const STOPPED = "noticed a bot stopped checking in";
const RECOVERED = "noticed a bot checking in again";

/** Each bot's newest check-in across its unrevoked keys. The runner never posts a heartbeat; its every call counts. */
async function lastCheckIns(): Promise<Map<Bot, Date>> {
  const keys = await (await db()).select().from(botKeys).where(isNull(botKeys.revokedAt));
  const newest = new Map<Bot, Date>();
  for (const key of keys) {
    const at = key.lastHeartbeatAt ?? key.lastUsedAt;
    const bot = key.bot as Bot;
    if (at && at > (newest.get(bot) ?? new Date(0))) newest.set(bot, at);
  }
  return newest;
}

/** Bots whose latest watch entry in the activity log says they stopped, so an outage is reported once. */
async function reportedBots(): Promise<Set<Bot>> {
  const rows = await (await db())
    .select({ action: activity.action, detail: activity.detail })
    .from(activity)
    .where(and(eq(activity.actor, WATCH_ACTOR), inArray(activity.action, [STOPPED, RECOVERED])))
    .orderBy(desc(activity.at))
    .limit(50);
  const latest = new Map<string, string>();
  for (const row of rows) if (!latest.has(row.detail)) latest.set(row.detail, row.action);
  return new Set(BOTS.filter((bot) => latest.get(BOT_LABEL[bot]) === STOPPED));
}

async function recordEach(bots: Bot[], action: string) {
  for (const bot of bots) await record(WATCH_ACTOR, action, { detail: BOT_LABEL[bot] });
}

/** Emails both founders when a bot stops checking in, and once more when it comes back. Vercel Cron runs it twice an hour. */
export async function watchBots(now = new Date()) {
  const checkIns = await lastCheckIns();
  const { stopped, recovered } = botWatchChanges(checkIns, await reportedBots(), now);
  const botsPage = `${env.siteUrl()}/admin/setup/bots`;
  if (stopped.length) {
    const email = stoppedEmail(stopped, checkIns, botsPage);
    await emailFounders(email.subject, email.body);
    await recordEach(stopped, STOPPED);
  }
  if (recovered.length) {
    const email = recoveredEmail(recovered, botsPage);
    await emailFounders(email.subject, email.body);
    await recordEach(recovered, RECOVERED);
  }
  return { stopped, recovered };
}
