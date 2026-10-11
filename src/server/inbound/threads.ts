import "server-only";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "../db/client";
import { inboundRequests } from "../db/schema";
import type { RequestThread } from "../outreach/compose";

/** The email each business asked us in, newest first, so the request email can answer in that thread. */
export async function requestThreads(businessIds: string[]): Promise<Map<string, RequestThread>> {
  if (businessIds.length === 0) return new Map();
  const rows = await (await db())
    .select()
    .from(inboundRequests)
    .where(and(inArray(inboundRequests.businessId, businessIds), eq(inboundRequests.source, "email"), isNotNull(inboundRequests.threadId)))
    .orderBy(desc(inboundRequests.at));
  const threads = new Map<string, RequestThread>();
  for (const row of rows) {
    if (row.businessId && !threads.has(row.businessId)) threads.set(row.businessId, { threadId: row.threadId, headerMessageId: row.headerMessageId, subject: row.subject });
  }
  return threads;
}
