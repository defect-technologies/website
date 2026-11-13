/**
 * What a cold email does to its lead when something fails, and what the daily limit counts.
 *
 *   npm test
 *
 * Runs against an in-memory Postgres (PGlite) migrated from drizzle/, with the Gmail send stood in for.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema";

process.env.TZ = "UTC";
process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";

mock.module("server-only", {});
mock.module("next/headers", { namedExports: { cookies: async () => ({}) } });
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });

type Delivery = Awaited<ReturnType<typeof import("../mail/outbox").deliver>>;
let deliverImpl: (compose: (from: null) => unknown) => Promise<Delivery>;
mock.module("../mail/outbox", {
  namedExports: {
    deliver: (compose: (from: null) => unknown) => deliverImpl(compose),
    connectedMailboxes: async () => [],
    sendingMailbox: async () => null,
    NoSendingInbox: class extends Error {},
  },
});

const pglite = new PGlite();
const database = drizzle(pglite, { schema });
(globalThis as { defectDb?: Promise<unknown> }).defectDb = Promise.resolve(database);

const { sendOutreach, skipLead, unskipLead } = await import("./send");
const { sentToday } = await import("./queue");
const { SendOutcomeUnknown } = await import("../mail/gmail");
const { saveOutreachSettings } = await import("../settings");
const { DEFAULT_SETTINGS } = await import("@/lib/emailTemplate");

const { activity, businesses, messages } = schema;
const founder = { email: "boris@defect.tech" } as never;
let businessId: string;

const delivered = (gmailId: string, mailbox: unknown = null) =>
  ({
    gmailId,
    threadId: `thread-${gmailId}`,
    headerMessageId: `<${gmailId}@cold.example>`,
    mailbox,
    email: { from: { name: "Boris", email: "cold@example.com" }, to: "owner@shop.example", subject: "Hi", body: "Hello" },
  }) as unknown as Delivery;

const savedBusiness = async () => (await database.select().from(businesses).where(eq(businesses.id, businessId)))[0];

before(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });
  await saveOutreachSettings({ ...DEFAULT_SETTINGS, mailingAddress: "1 Main St, Los Angeles, CA", senderName: "Boris", dailyLimit: 50 }, "test");
});
after(async () => {
  await pglite.close();
});

beforeEach(async () => {
  await database.delete(activity);
  await database.delete(messages);
  await database.delete(businesses);
  [{ id: businessId }] = await database
    .insert(businesses)
    .values({
      slug: "shop",
      linkCode: "abc123",
      businessName: "Shop",
      email: "owner@shop.example",
      previewUrl: "https://shop.preview.example",
      priceArm: 59,
      problemSummary: "the site is slow",
      stage: "preview_built",
    })
    .returning({ id: businesses.id });
});

describe("sendOutreach after a failure", () => {
  it("opens the claim again when Gmail refused the email", async () => {
    deliverImpl = async () => {
      throw new Error("Gmail /messages/send answered 400");
    };
    const result = await sendOutreach("first", businessId, founder);
    assert.equal(result.ok, false);
    assert.equal((await savedBusiness()).firstSentAt, null);
  });

  it("keeps the claim when Gmail may have accepted the email", async () => {
    deliverImpl = async () => {
      throw new SendOutcomeUnknown("Gmail /messages/send did not answer. The email may have gone out.");
    };
    const result = await sendOutreach("first", businessId, founder);
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, /may have gone out/);
    assert.notEqual((await savedBusiness()).firstSentAt, null);
  });

  it("keeps the claim and reports the email as sent when saving the record fails", async () => {
    deliverImpl = async () => delivered("sent-1", { id: "not-a-database-id" });
    const result = await sendOutreach("first", businessId, founder);
    assert.equal(result.ok, true);
    assert.notEqual((await savedBusiness()).firstSentAt, null);
    const [note] = await database.select().from(activity).where(eq(activity.businessId, businessId));
    assert.match(note.action, /sent/);
  });

  it("finishes the record when the mail sync already stored the same Gmail message", async () => {
    await database.insert(messages).values({ businessId, direction: "out", kind: "reply", gmailId: "sent-2", fromAddress: "cold@example.com", toAddress: "owner@shop.example", body: "Hello" });
    deliverImpl = async () => delivered("sent-2");
    const result = await sendOutreach("first", businessId, founder);
    assert.equal(result.ok, true);
    assert.equal((await savedBusiness()).stage, "sent");
  });
});

describe("the daily limit at the moment of sending", () => {
  it("lets only one of two founders send when one email is left under the limit", async () => {
    await saveOutreachSettings({ ...DEFAULT_SETTINGS, mailingAddress: "1 Main St, Los Angeles, CA", senderName: "Boris", dailyLimit: 1 }, "test");
    const [{ id: otherId }] = await database
      .insert(businesses)
      .values({ slug: "other", linkCode: "def456", businessName: "Other", email: "owner@other.example", previewUrl: "https://other.preview.example", priceArm: 59, problemSummary: "the site is slow", stage: "preview_built" })
      .returning({ id: businesses.id });
    let sends = 0;
    deliverImpl = async () => {
      sends += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return delivered(`race-${sends}`);
    };
    try {
      const results = await Promise.all([sendOutreach("first", businessId, founder), sendOutreach("first", otherId, founder)]);
      assert.equal(results.filter((result) => result.ok).length, 1);
      assert.equal(sends, 1);
    } finally {
      await saveOutreachSettings({ ...DEFAULT_SETTINGS, mailingAddress: "1 Main St, Los Angeles, CA", senderName: "Boris", dailyLimit: 50 }, "test");
    }
  });
});

describe("unskipLead", () => {
  const skipThenUndo = async () => {
    await skipLead(await savedBusiness(), founder, "Skipped from the outreach queue.");
    assert.equal((await savedBusiness()).stage, "lost");
    await unskipLead(await savedBusiness(), founder);
    return savedBusiness();
  };

  it("puts a lead with no first email back in the first-email queue", async () => {
    assert.equal((await skipThenUndo()).stage, "preview_built");
  });

  it("puts a lead that was already emailed back where its follow-up is due", async () => {
    await database.update(businesses).set({ stage: "sent", firstSentAt: new Date() }).where(eq(businesses.id, businessId));
    assert.equal((await skipThenUndo()).stage, "sent");
  });

  it("puts a lead that clicked back as clicked", async () => {
    await database.update(businesses).set({ stage: "clicked", firstSentAt: new Date(), clickedAt: new Date() }).where(eq(businesses.id, businessId));
    assert.equal((await skipThenUndo()).stage, "clicked");
  });
});

/** The Los Angeles midnight that began the current Pacific day. */
function pacificMidnight(): Date {
  const hourInLosAngeles = (date: Date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "2-digit", hourCycle: "h23" }).format(date));
  const now = new Date();
  const candidates = [-1, 0, 1].map((dayShift) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayShift, 7)));
  const candidate = candidates.flatMap((day) => [day, new Date(day.getTime() + 3_600_000)]).filter((moment) => hourInLosAngeles(moment) === 0 && moment <= now);
  return candidate[candidate.length - 1];
}

describe("sentToday", () => {
  it("counts from midnight in Los Angeles, not midnight on the server", async () => {
    const midnight = pacificMidnight();
    const sentAt = (offsetMs: number) => new Date(midnight.getTime() + offsetMs);
    const row = (gmailId: string, at: Date) => ({ businessId, direction: "out" as const, kind: "first" as const, gmailId, fromAddress: "a@b.c", toAddress: "d@e.f", body: "x", at });
    await database.insert(messages).values([row("before", sentAt(-3_600_000)), row("after", sentAt(3_600_000))]);
    assert.equal(await sentToday(), 1);
  });
});
