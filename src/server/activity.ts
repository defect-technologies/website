import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "./db/client";
import { activity } from "./db/schema";

/** Review-queue priorities from 02-system/oversight.md. Most entries have none. */
export type Priority = "" | "fyi" | "review" | "urgent";

type Detail = { businessId?: string | null; detail?: string; priority?: Priority };

export async function record(actor: string, action: string, { businessId = null, detail = "", priority = "" }: Detail = {}) {
  await (await db()).insert(activity).values({ actor, action, businessId, detail, priority });
}

export async function activityFor(businessId: string) {
  return (await db()).select().from(activity).where(eq(activity.businessId, businessId)).orderBy(desc(activity.at)).limit(50);
}

/** The latest entries flagged for the review queue at one priority, newest first. */
export async function flaggedActivity(priority: Exclude<Priority, "">, limit = 10) {
  return (await db()).select().from(activity).where(eq(activity.priority, priority)).orderBy(desc(activity.at)).limit(limit);
}
