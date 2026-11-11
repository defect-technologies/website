/**
 * Rules the database and the money code keep: an inbox can be disconnected without losing its mail,
 * and one month is settled once.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

mock.module("server-only", {});
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });
mock.module("@/server/auth/session", { namedExports: { requireFounder: async () => ({ email: "founder@example.com" }) } });
mock.module("@/server/integrations/stripe", { namedExports: { syncPayments: async () => ({}) } });
mock.module("@/server/leads/businesses", { namedExports: { updateBusiness: async () => ({}) } });

const pglite = new PGlite();
const database = drizzle(pglite, { schema });
(globalThis as { defectDb?: Promise<unknown> }).defectDb = Promise.resolve(database);

const { disconnectMailboxAction } = await import("@/app/admin/(panel)/setup/connections/actions");
const { settleMonth } = await import("../expenses/expenses");
const { FOUNDER_EMAILS } = await import("@/lib/founders");

before(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });
});

after(async () => {
  await pglite.close();
});

describe("disconnecting an inbox", () => {
  it("removes the inbox and keeps its messages and requests", async () => {
    const [mailbox] = await database.insert(schema.mailboxes).values({ email: "sales@example.com", sealedRefreshToken: "sealed", connectedBy: "founder@example.com" }).returning();
    const [business] = await database.insert(schema.businesses).values({ slug: "acme", linkCode: "acme-code", businessName: "Acme" }).returning();
    await database.insert(schema.messages).values({ businessId: business.id, mailboxId: mailbox.id, direction: "out", kind: "first", fromAddress: "sales@example.com", toAddress: "a@acme.example", body: "Hello" });
    await database.insert(schema.inboundRequests).values({ source: "email", email: "a@acme.example", mailboxId: mailbox.id });

    await disconnectMailboxAction(mailbox.id);

    assert.equal((await database.select().from(schema.mailboxes).where(eq(schema.mailboxes.id, mailbox.id))).length, 0);
    const [message] = await database.select().from(schema.messages);
    assert.equal(message.body, "Hello");
    assert.equal(message.mailboxId, null);
    const [request] = await database.select().from(schema.inboundRequests);
    assert.equal(request.mailboxId, null);
  });
});

describe("settling a month", () => {
  it("records one settlement when two founders press Settle together", async () => {
    const [first, second] = FOUNDER_EMAILS;
    await database.insert(schema.expenses).values({ spentOn: "2026-09-10", item: "Domain", amountCents: 10000, paidBy: first, createdBy: first });

    const results = await Promise.all([settleMonth("2026-09", first), settleMonth("2026-09", second)]);

    assert.equal(results.filter(Boolean).length, 1);
    assert.equal((await database.select().from(schema.settlements).where(eq(schema.settlements.month, "2026-09"))).length, 1);
  });
});
