import "server-only";
import { eq, isNotNull } from "drizzle-orm";
import { cancelledAt, type SubscriptionCancelState } from "@/lib/cancellation";
import { record } from "../activity";
import { db } from "../db/client";
import { businesses } from "../db/schema";
import { env } from "../env";
import { integration } from "./result";
import { stripe } from "./stripe";

type ListedSubscription = SubscriptionCancelState & { id: string };

const PAGE_SIZE = 100;

async function everySubscription(): Promise<Map<string, ListedSubscription>> {
  const found = new Map<string, ListedSubscription>();
  let startingAfter = "";
  for (;;) {
    const cursor = startingAfter ? `&starting_after=${startingAfter}` : "";
    const page = await stripe<{ data: ListedSubscription[]; has_more: boolean }>(`/subscriptions?status=all&limit=${PAGE_SIZE}${cursor}`);
    for (const subscription of page.data) found.set(subscription.id, subscription);
    const last = page.data.at(-1);
    if (!page.has_more || !last) return found;
    startingAfter = last.id;
  }
}

const sameMoment = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

/** Keeps each client's cancelledAt in step with their Stripe plan: set when they cancel, cleared if they resume. */
export function syncCancellations() {
  return integration({ STRIPE_API_KEY: env.stripeKey() }, async () => {
    const database = await db();
    const clients = await database
      .select({ id: businesses.id, subscriptionId: businesses.stripeSubscriptionId, cancelledAt: businesses.cancelledAt })
      .from(businesses)
      .where(isNotNull(businesses.stripeSubscriptionId));
    if (!clients.length) return { changed: 0 };
    const subscriptions = await everySubscription();
    let changed = 0;
    for (const client of clients) {
      const subscription = subscriptions.get(client.subscriptionId ?? "");
      if (!subscription) continue;
      const next = cancelledAt(subscription);
      if (sameMoment(next, client.cancelledAt)) continue;
      await database.update(businesses).set({ cancelledAt: next, updatedAt: new Date() }).where(eq(businesses.id, client.id));
      await record("stripe sync", next ? "client cancelled" : "client resumed their plan", { businessId: client.id });
      changed += 1;
    }
    return { changed };
  });
}
