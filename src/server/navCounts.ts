import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "./db/client";
import { messages } from "./db/schema";
import { openFlagCount } from "./bots/flags";
import { outreachQueue } from "./outreach/queue";

export async function navCounts() {
  const [queue, [unread], review] = await Promise.all([
    outreachQueue(),
    (await db())
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.direction, "in"), isNull(messages.readAt))),
    openFlagCount(),
  ]);
  const sendable = [...queue.followUps, ...queue.firstEmails].filter((item) => item.blockers.length === 0).length;
  return { outreach: sendable, messages: unread?.count ?? 0, review };
}
