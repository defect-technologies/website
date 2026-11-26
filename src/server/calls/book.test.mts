/**
 * Booking a call on defect.tech/call: a time is checked again before it's taken.
 *
 *   npm test
 *
 * Runs against an in-memory Postgres (PGlite) migrated from drizzle/, with Google Calendar stood in for.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema";

process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";
mock.module("server-only", {});

type Span = { start: number; end: number };
let busy: Span[] = [];
let added: { start: number; email: string }[] = [];
let addFails = false;

mock.module("./calendar", {
  namedExports: {
    callSetup: async () => ({ mailbox: { id: "m1" }, calendars: ["brendan@example.com"] }),
    busyTimes: async () => busy,
    addCall: async (_setup: unknown, call: { start: number; email: string }) => {
      if (addFails) throw new Error("Google Calendar answered 403 when adding the call");
      added.push(call);
    },
  },
});

const pglite = new PGlite();
const database = drizzle(pglite, { schema });
(globalThis as { defectDb?: Promise<unknown> }).defectDb = Promise.resolve(database);

const { bookCall, CALLS_ACTOR } = await import("./book");
const { activity, businesses } = schema;

/** Thursday, Nov 26, 2026, noon in Los Angeles. Monday the 30th at 10 AM is 18:00 UTC. */
const NOW = Date.UTC(2026, 10, 26, 20);
const MONDAY_TEN = Date.UTC(2026, 10, 30, 18);
const call = { start: MONDAY_TEN, name: "Pat Owner", email: "pat@bakery.example", business: "Sunrise Bakery", note: "" };

before(async () => migrate(database, { migrationsFolder: "drizzle" }));
after(async () => pglite.close());
beforeEach(async () => {
  busy = [];
  added = [];
  addFails = false;
  await database.delete(activity);
  await database.delete(businesses);
});

const logged = () => database.select().from(activity).where(eq(activity.actor, CALLS_ACTOR));

describe("bookCall", () => {
  it("adds a free time and logs it on the owner's business", async () => {
    const [{ id }] = await database
      .insert(businesses)
      .values({ slug: "sunrise", linkCode: "code-sunrise", businessName: "Sunrise Bakery", email: "pat@bakery.example" })
      .returning({ id: businesses.id });
    assert.deepEqual(await bookCall(call, NOW), { booked: true });
    assert.deepEqual(added.map((entry) => entry.start), [MONDAY_TEN]);
    const [entry] = await logged();
    assert.equal(entry.action, "booked a call");
    assert.equal(entry.businessId, id);
  });

  it("refuses a time that became busy and hands back the times still free", async () => {
    busy = [{ start: MONDAY_TEN, end: MONDAY_TEN + 30 * 60_000 }];
    const outcome = await bookCall(call, NOW);
    assert.equal(outcome.booked, false);
    assert.equal(outcome.booked === false && outcome.reason, "taken");
    assert.equal(added.length, 0);
  });

  it("refuses a time that was never offered", async () => {
    const outcome = await bookCall({ ...call, start: MONDAY_TEN + 10 * 60_000 }, NOW);
    assert.equal(outcome.booked === false && outcome.reason, "taken");
  });

  it("flags a failed booking for review", async () => {
    addFails = true;
    assert.deepEqual(await bookCall(call, NOW), { booked: false, reason: "unavailable" });
    const [entry] = await logged();
    assert.equal(entry.action, "could not book a call");
    assert.equal(entry.priority, "review");
  });
});
