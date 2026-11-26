import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { record } from "../activity";
import type { Founder } from "../auth/session";
import { db } from "../db/client";
import { messages, previewReviews } from "../db/schema";
import { outreachSettings } from "../settings";
import { outreachQueue, type QueueItem } from "./queue";
import { sendOutreach } from "./send";

/** Who the activity log and each message's sentBy name for an email the admin sent on its own. */
export const AUTO_SENDER_EMAIL = "auto-send";

/** Owners read cold email at work: weekdays, 9 AM to 4 PM in Los Angeles. */
const SEND_DAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);
const FIRST_HOUR = 9;
const LAST_HOUR = 16;
/** At most one email this often, so a day's emails spread out the way one person sends them. */
const MINUTES_BETWEEN = 20;
const ATTEMPTS_PER_RUN = 3;

export type AutoSendOutcome = { sent: string } | { skipped: string };

function pacificClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return { weekday: part("weekday"), hour: Number(part("hour")) };
}

export function withinSendingHours(now: Date): boolean {
  const { weekday, hour } = pacificClock(now);
  return SEND_DAYS.has(weekday) && hour >= FIRST_HOUR && hour < LAST_HOUR;
}

async function minutesSinceLastSend(now: Date): Promise<number> {
  const [row] = await (await db())
    .select({ at: sql<Date | null>`max(${messages.at})` })
    .from(messages)
    .where(and(eq(messages.direction, "out"), inArray(messages.kind, ["first", "follow_up", "requested"])));
  if (!row?.at) return Number.POSITIVE_INFINITY;
  return (now.getTime() - new Date(row.at).getTime()) / 60_000;
}

/** The preview each business has that a founder or designer approved on Review. */
async function approvedPreviews(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await (await db())
    .select({ businessId: previewReviews.businessId, previewUrl: previewReviews.previewUrl })
    .from(previewReviews)
    .where(and(eq(previewReviews.verdict, "approved"), inArray(previewReviews.businessId, ids)));
  return new Set(rows.map((row) => `${row.businessId} ${row.previewUrl}`));
}

const isApproved = (approved: Set<string>) => (item: QueueItem) => approved.has(`${item.business.id} ${item.business.previewUrl}`);
const isReady = (item: QueueItem) => item.blockers.length === 0;

/**
 * What goes out next: a business that asked us first, then follow-ups, then first emails. A preview's first email waits
 * for its approval on Review, because nobody else looks at it before the owner does. A follow-up repeats an email that
 * already went out, so it needs none.
 */
export async function nextEmails(): Promise<QueueItem[]> {
  const queue = await outreachQueue();
  const unsent = [...queue.requested, ...queue.firstEmails];
  const approved = isApproved(await approvedPreviews(unsent.map((item) => item.business.id)));
  const coldRoomLeft = queue.sentToday < queue.settings.dailyLimit;
  const cold = coldRoomLeft ? [...queue.followUps, ...queue.firstEmails.filter(approved)] : [];
  return [...queue.requested.filter(approved), ...cold].filter(isReady);
}

async function whyNotNow(now: Date): Promise<string | null> {
  if (!withinSendingHours(now)) return "Outside weekday sending hours in Los Angeles.";
  if ((await minutesSinceLastSend(now)) < MINUTES_BETWEEN) return `The last email went out less than ${MINUTES_BETWEEN} minutes ago.`;
  return null;
}

/**
 * Sends the next due email when Setup > Outreach has automatic sending on. Vercel Cron calls it every few minutes; each
 * call sends one email at most. An email that fails is logged and the next one is tried, so one bad lead can't hold
 * the queue.
 */
export async function sendNextApprovedEmail(now = new Date()): Promise<AutoSendOutcome> {
  const settings = await outreachSettings();
  if (!settings.autoSend) return { skipped: "Automatic sending is off in Setup > Outreach." };
  const notNow = await whyNotNow(now);
  if (notNow) return { skipped: notNow };
  const sender: Founder = { email: AUTO_SENDER_EMAIL, name: settings.senderName };
  for (const item of (await nextEmails()).slice(0, ATTEMPTS_PER_RUN)) {
    const result = await sendOutreach(item.kind, item.business.id, sender);
    if (result.ok) return { sent: `${item.kind} to ${item.business.businessName}` };
    await record(AUTO_SENDER_EMAIL, "could not send", { businessId: item.business.id, detail: result.error });
  }
  return { skipped: "Nothing is due." };
}
