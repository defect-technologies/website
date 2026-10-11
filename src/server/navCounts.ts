import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "./db/client";
import { messages } from "./db/schema";
import { openFlagCount } from "./bots/flags";
import { outreachQueue } from "./outreach/queue";
import { openSpotCheckCount } from "./spotChecks";
import { waitingRequestCount } from "./inbound/requests";

export async function navCounts() {
  const [queue, [unread], review, spotChecks, requests] = await Promise.all([
    outreachQueue(),
    (await db())
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.direction, "in"), isNull(messages.readAt))),
    openFlagCount(),
    openSpotCheckCount(),
    waitingRequestCount(),
  ]);
  const sendable = [...queue.requested, ...queue.followUps, ...queue.firstEmails].filter((item) => item.blockers.length === 0).length;
  return { outreach: sendable, messages: unread?.count ?? 0, review, spotChecks, requests };
}
