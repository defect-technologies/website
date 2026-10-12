import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { REGULAR_MONTHLY_PRICE } from "@/lib/emailTemplate";
import { record } from "../activity";
import { db } from "../db/client";
import { businesses, settings, type Business } from "../db/schema";
import { env } from "../env";
import { advanceStage, businessById } from "../leads/businesses";
import { sendWelcome } from "../onboarding/welcome";
import { getJson, integration } from "./result";

const API = "https://api.stripe.com/v1";
const SYNC_KEY = "sync.stripe";

type Price = { unit_amount: number | null; recurring: { interval: "month" | "year" } | null };
type Subscription = { id: string; customer: string; items: { data: { price: Price; quantity?: number }[] } };
type CheckoutSession = {
  id: string;
  created: number;
  status: "open" | "complete" | "expired";
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

/** $59 and $79 a month, or $708 and $948 a year. */
function planFor(cents: number | null) {
  const dollars = (cents ?? 0) / 100;
  return dollars >= 500 ? `$${dollars}/year` : `$${dollars}/month`;
}

async function businessForSession(session: CheckoutSession, all: Business[]): Promise<Business | undefined> {
  const byReference = session.client_reference_id ? await businessById(session.client_reference_id) : null;
  const email = session.customer_details?.email?.toLowerCase();
  return byReference ?? all.find((b) => email && b.email === email);
}

/**
 * Records the payment once. The welcome page's return and the half-hourly sync can both see the
 * same checkout, so only the one that sets paidAt goes on to send the welcome email.
 */
async function markPaid(session: CheckoutSession, business: Business) {
  const payerEmail = (session.customer_details?.email ?? "").toLowerCase();
  const claimed = await (await db())
    .update(businesses)
    .set({
      paidAt: new Date(session.created * 1000),
      plan: planFor(session.amount_total),
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      ownerEmail: business.ownerEmail || payerEmail,
      updatedAt: new Date(),
    })
    .where(and(eq(businesses.id, business.id), isNull(businesses.paidAt)))
    .returning({ id: businesses.id });
  if (claimed.length === 0) return;
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

type RecurringPrice = { id: string; unit_amount: number | null; recurring: { interval: string } | null };

/** The active monthly price for a price arm, found by its amount so it doesn't depend on lookup keys being set. */
async function monthlyPriceFor(dollars: number): Promise<string> {
  const { data } = await stripe<{ data: RecurringPrice[] }>("/prices?active=true&type=recurring&limit=100");
  const price = data.find((candidate) => candidate.unit_amount === dollars * 100 && candidate.recurring?.interval === "month");
  if (!price) throw new Error(`Stripe has no active $${dollars} monthly price.`);
  return price.id;
}

/** The monthly price a lead signs up at: its price arm, or our regular price for a lead without one. */
export function monthlyPriceOf(business: Business) {
  return business.priceArm ?? REGULAR_MONTHLY_PRICE;
}

/**
 * A checkout for the welcome page, embedded in it, tagged with the lead's ID so the payment is
 * matched back to it. Returns the client secret the page mounts Stripe's form with.
 */
export async function startWelcomeCheckout(business: Business, returnUrl: string): Promise<string> {
  if (!env.stripeKey()) throw new Error("STRIPE_API_KEY isn't set.");
  const email = business.ownerEmail || business.email;
  const created = await stripePost<{ client_secret: string }>("/checkout/sessions", {
    ui_mode: "embedded_page",
    mode: "subscription",
    "line_items[0][price]": await monthlyPriceFor(monthlyPriceOf(business)),
    "line_items[0][quantity]": "1",
    client_reference_id: business.id,
    allow_promotion_codes: "true",
    "consent_collection[terms_of_service]": "required",
    "custom_text[terms_of_service_acceptance][message]": `I agree to the [Terms of Service](${new URL("/terms", env.siteUrl())}).`,
    "subscription_data[metadata][lead_id]": business.id,
    return_url: returnUrl,
    ...(email ? { customer_email: email } : {}),
  });
  if (!created.ok) throw new Error(`Stripe refused the checkout: ${created.body.error?.message ?? "no reason given"}`);
  return created.body.client_secret;
}

/** Where a welcome-page checkout stands once Stripe sends the owner back, recording the payment if it went through. */
export async function finishWelcomeCheckout(sessionId: string, business: Business): Promise<CheckoutSession["status"] | "unknown"> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId) || !env.stripeKey()) return "unknown";
  const session = await stripe<CheckoutSession>(`/checkout/sessions/${sessionId}`).catch(() => null);
  if (!session || session.client_reference_id !== business.id) return "unknown";
  if (session.status === "complete" && !business.paidAt) await markPaid(session, business);
  return session.status;
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

type ArmPrice = { id: string; product: string; lookup_key: string | null; metadata?: Record<string, string> };
type PortalConfiguration = { id: string; active: boolean; metadata: Record<string, string> | null };

/** The price test arm ($59 or $79) of the customer's current plan, from its price's metadata or lookup key. */
async function currentArm(customerId: string): Promise<string | null> {
  const { data } = await stripe<{ data: { items: { data: { price: ArmPrice }[] } }[] }>(`/subscriptions?customer=${encodeURIComponent(customerId)}&status=active&limit=1`);
  const price = data[0]?.items.data[0]?.price;
  return price?.metadata?.price_arm || price?.lookup_key?.match(/^website_(\d+)_/)?.[1] || null;
}

/**
 * Billing page settings that let a client switch between monthly and yearly at their own price,
 * and never to the other arm's: a $59 client sees $59 a month and $708 a year, nothing else.
 * One per arm, found again by its metadata and remade if the arm's prices change.
 */
async function switchingConfiguration(arm: string): Promise<string | null> {
  const keys = [`website_${arm}_month`, `website_${arm}_year`];
  const { data: prices } = await stripe<{ data: ArmPrice[] }>(`/prices?active=true&${keys.map((key) => `lookup_keys[]=${key}`).join("&")}`);
  const ordered = keys.map((key) => prices.find((price) => price.lookup_key === key));
  if (ordered.some((price) => !price)) return null;
  const priceIds = ordered.map((price) => price!.id).join(",");
  const { data: existing } = await stripe<{ data: PortalConfiguration[] }>("/billing_portal/configurations?active=true&limit=100");
  const match = existing.find((config) => config.metadata?.defect_arm === arm && config.metadata?.defect_prices === priceIds);
  if (match) return match.id;
  const created = await stripePost<{ id: string }>("/billing_portal/configurations", {
    ...PORTAL_FEATURES,
    "features[subscription_update][enabled]": "true",
    "features[subscription_update][default_allowed_updates][0]": "price",
    "features[subscription_update][proration_behavior]": "create_prorations",
    "features[subscription_update][products][0][product]": ordered[0]!.product,
    "features[subscription_update][products][0][prices][0]": ordered[0]!.id,
    "features[subscription_update][products][0][prices][1]": ordered[1]!.id,
    "metadata[defect_arm]": arm,
    "metadata[defect_prices]": priceIds,
  });
  if (!created.ok) throw new Error(`Stripe refused the plan-switching settings: ${created.body.error?.message ?? "no reason given"}`);
  return created.body.id;
}

/** The settings for this customer's billing page: plan switching at their own price when it can be set up, else the default. */
async function configurationFor(customerId: string): Promise<string | null> {
  try {
    const arm = await currentArm(customerId);
    return arm ? await switchingConfiguration(arm) : null;
  } catch (error) {
    console.error("[stripe] Plan switching unavailable, opening the billing page without it", error);
    return null;
  }
}

/** A one-time link to the client's Stripe billing page, where they can also switch between monthly and yearly. */
export async function billingPortalLink(customerId: string, returnUrl: string): Promise<string> {
  if (!env.stripeKey()) throw new Error("STRIPE_API_KEY isn't set.");
  const configuration = await configurationFor(customerId);
  if (!configuration) await ensurePortalConfiguration();
  const session = await stripePost<{ url: string }>("/billing_portal/sessions", {
    customer: customerId,
    return_url: returnUrl,
    ...(configuration ? { configuration } : {}),
  });
  if (!session.ok) throw new Error(`Stripe refused the billing link: ${session.body.error?.message ?? "no reason given"}`);
  return session.body.url;
}

type PlanSubscription = {
  status: string;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  current_period_end?: number;
  items: { data: { price: Price; quantity?: number; current_period_end?: number }[] };
};

export type ClientPlan = {
  cents: number;
  interval: "month" | "year";
  status: string;
  /** When the next charge happens, or when the plan ends if it's cancelled. */
  periodEnd: Date | null;
  ending: boolean;
};

const PLAN_STATUSES = ["active", "past_due", "trialing", "unpaid", "canceled"];

/** The client's current plan from Stripe, or null when they have none. */
export function clientPlan(customerId: string) {
  return integration({ STRIPE_API_KEY: env.stripeKey() }, async (): Promise<ClientPlan | null> => {
    const { data } = await stripe<{ data: PlanSubscription[] }>(`/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=10`);
    const subscription = PLAN_STATUSES.map((status) => data.find((candidate) => candidate.status === status)).find(Boolean);
    const item = subscription?.items.data[0];
    if (!subscription || !item) return null;
    const periodEnd = item.current_period_end ?? subscription.current_period_end;
    return {
      cents: (item.price.unit_amount ?? 0) * (item.quantity ?? 1),
      interval: item.price.recurring?.interval ?? "month",
      status: subscription.status,
      periodEnd: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : periodEnd ? new Date(periodEnd * 1000) : null,
      ending: subscription.cancel_at_period_end || Boolean(subscription.cancel_at),
    };
  });
}
