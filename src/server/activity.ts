import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "./db/client";
import { activity } from "./db/schema";

type Detail = { businessId?: string | null; detail?: string };

export async function record(actor: string, action: string, { businessId = null, detail = "" }: Detail = {}) {
  await (await db()).insert(activity).values({ actor, action, businessId, detail });
}

export async function activityFor(businessId: string) {
  return (await db()).select().from(activity).where(eq(activity.businessId, businessId)).orderBy(desc(activity.at)).limit(50);
}
