/**
 * Recording what Stripe says clients paid: the sync, its recovery of half-finished payments, and the calls' time limit.
 *
 *   npm test
 *
 * Runs against an in-memory Postgres (PGlite) migrated from drizzle/, with Stripe and the mailbox stubbed.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema";

process.env.STRIPE_API_KEY = "sk_test_stand_in";
mock.module("server-only", {});

const pglite = new PGlite();
const database = drizzle(pglite, { schema });
(globalThis as { defectDb?: Promise<unknown> }).defectDb = Promise.resolve(database);

const realSites = await import("../sites/clientSites");
let portalFailure: Error | null = null;
mock.module("../sites/clientSites", {
  namedExports: {
    openPortal: (...args: Parameters<typeof realSites.openPortal>) => {
      if (portalFailure) throw portalFailure;
      return realSites.openPortal(...args);
    },
  },
});

let welcomeFailure: Error | null = null;
let welcomesSent = 0;
mock.module("../mail/outbox", {
  namedExports: {
    connectedMailboxes: async () => [{ id: "studio", email: "hello@defect.tech" }],
    deliver: async (build: (from: null) => { to: string; body: string; from: { email: string } }) => {
      if (welcomeFailure) throw welcomeFailure;
      welcomesSent += 1;
      return { mailbox: null, gmailId: `gmail-${welcomesSent}`, threadId: "thread", headerMessageId: "<id>", email: build(null) };
    },
  },
});

const { syncPayments, billingPortalLink } = await import("./stripe");

const HOUR = 60 * 60;
const nowSeconds = () => Math.floor(Date.now() / 1000);
const realFetch = globalThis.fetch;
let stripeRequests: { url: URL; signal: AbortSignal | null | undefined }[] = [];
let checkoutPages: { id: string; created: number; reference: string }[][] = [];

function session({ id, created, reference }: { id: string; created: number; reference: string }) {
  return {
    id,
    created,
    status: "complete",
    client_reference_id: reference,
    customer: "cus_1",
    subscription: "sub_1",
    amount_total: 5900,
    customer_details: { email: "owner@example.com" },
  };
}

function stripeStandIn(input: string | URL | Request, init?: RequestInit) {
  const url = new URL(String(input));
  stripeRequests.push({ url, signal: init?.signal });
  const after = url.searchParams.get("starting_after");
  const pageIndex = after ? checkoutPages.findIndex((page) => page.some((checkout) => checkout.id === after)) + 1 : 0;
  const page = checkoutPages[pageIndex] ?? [];
  const body = { data: page.map(session), has_more: pageIndex < checkoutPages.length - 1 };
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

let counter = 0;
async function addLead(fields: Partial<typeof schema.businesses.$inferInsert> = {}) {
  counter += 1;
  const [row] = await database
    .insert(schema.businesses)
    .values({ slug: `lead-${counter}`, linkCode: `code${counter}`, businessName: `Lead ${counter}`, email: `lead${counter}@example.com`, previewUrl: `https://lead-${counter}.example.com`, stage: "sent", ...fields })
    .returning();
  return row!;
}

const leadNow = (id: string) => database.select().from(schema.businesses).where(eq(schema.businesses.id, id)).then((rows) => rows[0]!);
const portalsOf = (id: string) => database.select().from(schema.clientSites).where(eq(schema.clientSites.businessId, id));
const welcomesOf = (id: string) => database.select().from(schema.messages).where(eq(schema.messages.businessId, id));
const flagsRaised = () => database.select().from(schema.activity).where(eq(schema.activity.priority, "urgent"));
const longAgo = () => new Date(Date.now() - 60 * 60 * 1000);

before(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });
  globalThis.fetch = stripeStandIn as typeof fetch;
});

after(async () => {
  globalThis.fetch = realFetch;
  await pglite.close();
});

beforeEach(async () => {
  stripeRequests = [];
  checkoutPages = [];
  portalFailure = null;
  welcomeFailure = null;
  welcomesSent = 0;
  await database.delete(schema.activity);
  await database.delete(schema.messages);
  await database.delete(schema.clientSites);
  await database.delete(schema.settings);
  await database.delete(schema.businesses);
});

describe("syncPayments", () => {
  it("records a payment and opens the client's portal, stage and welcome email once", async () => {
    const lead = await addLead();
    checkoutPages = [[{ id: "cs_1", created: nowSeconds(), reference: lead.id }]];

    await syncPayments();
    await syncPayments();

    const paid = await leadNow(lead.id);
    assert.ok(paid.paidAt);
    assert.equal(paid.stage, "paid");
    assert.equal((await portalsOf(lead.id)).length, 1);
    assert.equal((await welcomesOf(lead.id)).length, 1);
  });

  it("reads every page of completed checkouts before moving on", async () => {
    const first = await addLead();
    const second = await addLead();
    checkoutPages = [[{ id: "cs_1", created: nowSeconds(), reference: first.id }], [{ id: "cs_2", created: nowSeconds(), reference: second.id }]];

    await syncPayments();

    assert.ok((await leadNow(first.id)).paidAt);
    assert.ok((await leadNow(second.id)).paidAt);
  });

  it("looks back past the last sync, because Stripe filters by when a checkout opened and not when it was paid", async () => {
    const lastSync = nowSeconds() - 2 * HOUR;
    await database.insert(schema.settings).values({ key: "sync.stripe", value: lastSync });
    const lead = await addLead();
    checkoutPages = [[{ id: "cs_late", created: lastSync - 3 * HOUR, reference: lead.id }]];

    await syncPayments();

    const listing = stripeRequests.find((request) => request.url.pathname === "/v1/checkout/sessions");
    assert.ok(Number(listing?.url.searchParams.get("created[gte]")) <= lastSync - 3 * HOUR);
  });

  it("gives every Stripe call a time limit", async () => {
    checkoutPages = [[]];
    await syncPayments();
    assert.ok(stripeRequests.length > 0);
    assert.ok(stripeRequests.every((request) => request.signal));
  });

  it("goes on to the next checkout when one of them fails", async () => {
    const broken = await addLead();
    const fine = await addLead();
    checkoutPages = [[
      { id: "cs_broken", created: nowSeconds(), reference: broken.id },
      { id: "cs_fine", created: nowSeconds(), reference: fine.id },
    ]];
    const realUpdate = database.update.bind(database);
    let failures = 0;
    (database as { update: unknown }).update = (table: unknown) => {
      if (table === schema.businesses && failures === 0) {
        failures += 1;
        throw new Error("claim failed");
      }
      return realUpdate(table as typeof schema.businesses);
    };
    try {
      await syncPayments();
    } finally {
      (database as { update: unknown }).update = realUpdate;
    }
    assert.ok((await leadNow(fine.id)).paidAt);
  });
});

describe("recovering half-finished payments", () => {
  it("opens the portal on a later sync after the step failed", async () => {
    const lead = await addLead();
    checkoutPages = [[{ id: "cs_1", created: nowSeconds(), reference: lead.id }]];
    portalFailure = new Error("database blip");

    await syncPayments();
    assert.equal((await portalsOf(lead.id)).length, 0);
    assert.equal((await flagsRaised()).length, 1);

    portalFailure = null;
    await database.update(schema.businesses).set({ updatedAt: longAgo() }).where(eq(schema.businesses.id, lead.id));
    await syncPayments();

    const recovered = await leadNow(lead.id);
    assert.equal(recovered.stage, "paid");
    assert.equal((await portalsOf(lead.id)).length, 1);
    assert.equal((await welcomesOf(lead.id)).length, 1);
  });

  it("sends the welcome email on a later sync after it failed, and raises a flag meanwhile", async () => {
    const lead = await addLead();
    checkoutPages = [[{ id: "cs_1", created: nowSeconds(), reference: lead.id }]];
    welcomeFailure = new Error("hello@defect.tech isn't connected");

    await syncPayments();
    assert.equal((await welcomesOf(lead.id)).length, 0);
    assert.equal((await flagsRaised()).length, 1);

    welcomeFailure = null;
    await database.update(schema.businesses).set({ updatedAt: longAgo() }).where(eq(schema.businesses.id, lead.id));
    await syncPayments();
    await syncPayments();

    assert.equal((await welcomesOf(lead.id)).length, 1);
  });

  it("leaves a fully set up client alone", async () => {
    const lead = await addLead();
    checkoutPages = [[{ id: "cs_1", created: nowSeconds(), reference: lead.id }]];
    await syncPayments();
    await database.update(schema.businesses).set({ updatedAt: longAgo() }).where(eq(schema.businesses.id, lead.id));
    await syncPayments();

    assert.equal(welcomesSent, 1);
    assert.equal((await portalsOf(lead.id)).length, 1);
  });

  it("leaves a client who paid long ago without a welcome email alone", async () => {
    const old = await addLead({ paidAt: new Date(Date.now() - 90 * 24 * HOUR * 1000), stage: "live", updatedAt: longAgo() });
    checkoutPages = [[]];

    await syncPayments();

    assert.equal(welcomesSent, 0);
    assert.equal((await portalsOf(old.id)).length, 0);
  });

  it("leaves a client whose payment is being recorded right now alone", async () => {
    const justPaid = await addLead({ paidAt: new Date(), stage: "sent" });
    checkoutPages = [[]];

    await syncPayments();

    assert.equal(welcomesSent, 0);
    assert.equal((await portalsOf(justPaid.id)).length, 0);
  });
});

describe("Stripe POST requests", () => {
  const portalStandIn = (posts: Headers[]) => (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (init?.method === "POST") {
      posts.push(new Headers(init.headers));
      return Promise.resolve(new Response(JSON.stringify({ url: "https://billing.example.com/session" }), { status: 200 }));
    }
    const body = url.pathname.endsWith("/billing_portal/configurations") ? { data: [{ id: "bpc_1", is_default: true }] } : { data: [] };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  };

  async function postedKeys(calls: [string, string][]) {
    const posts: Headers[] = [];
    globalThis.fetch = portalStandIn(posts) as typeof fetch;
    mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 10, 12, 12, 0, 5) });
    try {
      for (const [customer, returnUrl] of calls) await billingPortalLink(customer, returnUrl);
    } finally {
      mock.timers.reset();
      globalThis.fetch = stripeStandIn as typeof fetch;
    }
    return posts.map((headers) => headers.get("Idempotency-Key"));
  }

  it("carries an idempotency key, the same for the same request repeated", async () => {
    const [first, second] = await postedKeys([["cus_1", "https://defect.tech/a"], ["cus_1", "https://defect.tech/a"]]);
    assert.ok(first);
    assert.equal(first, second);
  });

  it("carries a different key for a different request", async () => {
    const [first, second, third] = await postedKeys([["cus_1", "https://defect.tech/a"], ["cus_2", "https://defect.tech/a"], ["cus_1", "https://defect.tech/b"]]);
    assert.notEqual(first, second);
    assert.notEqual(first, third);
  });
});
