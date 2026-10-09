import "server-only";
import { eq } from "drizzle-orm";
import { record } from "../activity";
import { db } from "../db/client";
import { businesses, settings, type Business } from "../db/schema";
import { env } from "../env";
import { advanceStage, businessById, updateBusiness } from "../leads/businesses";
import { getJson, integration } from "./result";

const API = "https://api.stripe.com/v1";
const SYNC_KEY = "sync.stripe";

type Price = { unit_amount: number | null; recurring: { interval: "month" | "year" } | null };
type Subscription = { id: string; customer: string; items: { data: { price: Price; quantity?: number }[] } };
type CheckoutSession = {
  id: string;
  created: number;
  client_reference_id: string | null;
  customer: string | null;
  subscription: string | null;
  amount_total: number | null;
  customer_details: { email: string | null } | null;
};

function stripe<T>(path: string) {
  return getJson<T>(`${API}${path}`, { Authorization: `Bearer ${env.stripeKey()}` });
}

function monthlyCents({ price, quantity = 1 }: { price: Price; quantity?: number }) {
  const amount = (price.unit_amount ?? 0) * quantity;
  return price.recurring?.interval === "year" ? amount / 12 : amount;
}

export type StripeSummary = { active: number; monthlyRevenue: number; yearly: number };

export function stripeSummary() {
  return integration({ STRIPE_API_KEY: env.stripeKey() }, async (): Promise<StripeSummary> => {
    const { data } = await stripe<{ data: Subscription[] }>("/subscriptions?status=active&limit=100");
    const items = data.flatMap((subscription) => subscription.items.data);
    return {
      active: data.length,
      monthlyRevenue: Math.round(items.reduce((sum, item) => sum + monthlyCents(item), 0)) / 100,
      yearly: items.filter((item) => item.price.recurring?.interval === "year").length,
    };
  });
}

/** $59 and $79 a month, or $590 and $790 a year. */
function planFor(cents: number | null) {
  const dollars = (cents ?? 0) / 100;
  return dollars >= 500 ? `$${dollars}/year` : `$${dollars}/month`;
}

async function businessForSession(session: CheckoutSession, all: Business[]): Promise<Business | undefined> {
  const byReference = session.client_reference_id ? await businessById(session.client_reference_id) : null;
  const email = session.customer_details?.email?.toLowerCase();
  return byReference ?? all.find((b) => email && b.email === email);
}

async function markPaid(session: CheckoutSession, business: Business) {
  await updateBusiness(business.id, {
    paidAt: new Date(session.created * 1000),
    plan: planFor(session.amount_total),
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
    ownerEmail: business.ownerEmail || (session.customer_details?.email ?? "").toLowerCase(),
  });
  await advanceStage(business.id, "paid");
  await record("stripe sync", "paid", { businessId: business.id, detail: planFor(session.amount_total) });
}

async function lastSync(): Promise<number> {
  const [row] = await (await db()).select().from(settings).where(eq(settings.key, SYNC_KEY));
  return (row?.value as number | undefined) ?? Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
}

async function saveSync(seconds: number) {
  await (await db())
    .insert(settings)
    .values({ key: SYNC_KEY, value: seconds })
    .onConflictDoUpdate({ target: settings.key, set: { value: seconds, updatedAt: new Date() } });
}

/** Completed checkouts since the last run. The preview's checkout link carries the lead's ID as client_reference_id. */
export function syncPayments() {
  return integration({ STRIPE_API_KEY: env.stripeKey() }, async () => {
    const since = await lastSync();
    const startedAt = Math.floor(Date.now() / 1000);
    const { data } = await stripe<{ data: CheckoutSession[] }>(`/checkout/sessions?status=complete&limit=100&created[gte]=${since}`);
    const all = await (await db()).select().from(businesses);
    let matched = 0;
    for (const session of data) {
      const business = await businessForSession(session, all);
      if (!business || business.paidAt) continue;
      await markPaid(session, business);
      matched += 1;
    }
    await saveSync(startedAt);
    return { checkouts: data.length, newClients: matched };
  });
}
