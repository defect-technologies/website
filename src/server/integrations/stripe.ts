import "server-only";
import { eq } from "drizzle-orm";
import { record } from "../activity";
import { db } from "../db/client";
import { businesses, settings, type Business } from "../db/schema";
import { env } from "../env";
import { advanceStage, businessById, updateBusiness } from "../leads/businesses";
import { sendWelcome } from "../onboarding/welcome";
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
  const payerEmail = (session.customer_details?.email ?? "").toLowerCase();
  await updateBusiness(business.id, {
    paidAt: new Date(session.created * 1000),
    plan: planFor(session.amount_total),
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
    ownerEmail: business.ownerEmail || payerEmail,
  });
  await advanceStage(business.id, "paid");
  await record("stripe sync", "paid", { businessId: business.id, detail: planFor(session.amount_total) });
  await sendWelcome(business, payerEmail || business.ownerEmail || business.email);
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

async function stripePost<T>(path: string, form: Record<string, string>): Promise<{ ok: boolean; body: T & { error?: { message?: string } } }> {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.stripeKey()}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
    cache: "no-store",
  });
  return { ok: response.ok, body: (await response.json()) as T & { error?: { message?: string } } };
}

/** What a client can do on their billing page. Created once, the first time a link is asked for, if the account has no portal settings yet. */
const PORTAL_FEATURES: Record<string, string> = {
  "business_profile[headline]": "Defect Technologies: your website plan",
  "features[invoice_history][enabled]": "true",
  "features[payment_method_update][enabled]": "true",
  "features[customer_update][enabled]": "true",
  "features[customer_update][allowed_updates][0]": "email",
  "features[customer_update][allowed_updates][1]": "address",
  "features[subscription_cancel][enabled]": "true",
  "features[subscription_cancel][mode]": "at_period_end",
};

async function ensurePortalConfiguration() {
  const { data } = await stripe<{ data: { id: string; is_default: boolean }[] }>("/billing_portal/configurations?is_default=true&limit=1");
  if (data.length > 0) return;
  const created = await stripePost<{ id: string }>("/billing_portal/configurations", PORTAL_FEATURES);
  if (!created.ok) throw new Error(`Stripe refused the billing page settings: ${created.body.error?.message ?? "no reason given"}`);
}

/** A one-time link to the client's Stripe billing page. */
export async function billingPortalLink(customerId: string, returnUrl: string): Promise<string> {
  if (!env.stripeKey()) throw new Error("STRIPE_API_KEY isn't set.");
  await ensurePortalConfiguration();
  const session = await stripePost<{ url: string }>("/billing_portal/sessions", { customer: customerId, return_url: returnUrl });
  if (!session.ok) throw new Error(`Stripe refused the billing link: ${session.body.error?.message ?? "no reason given"}`);
  return session.body.url;
}
