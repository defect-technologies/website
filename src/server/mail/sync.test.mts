/**
 * What the mail sync stores, and where it resumes, with Gmail stood in for.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema";

mock.module("server-only", {});
mock.module("next/headers", { namedExports: { cookies: async () => ({}) } });
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });

type Batch = { emails: unknown[]; resumeFrom: Date | null };
let inboxBatch: Batch = { emails: [], resumeFrom: null };
let sentBatch: Batch = { emails: [], resumeFrom: null };
let inboxReads = 0;
class MailboxNeedsReconnect extends Error {}
mock.module("./gmail", {
  namedExports: { MailboxNeedsReconnect, mailSince: async (_mailbox: unknown, folder: string) => {
      if (folder === "inbox") inboxReads += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return folder === "inbox" ? inboxBatch : sentBatch;
    },
  },
});

const pglite = new PGlite();
const database = drizzle(pglite, { schema });
(globalThis as { defectDb?: Promise<unknown> }).defectDb = Promise.resolve(database);

const { syncMail, syncMailIfStale } = await import("./sync");

const { businesses, mailboxes, messages } = schema;
let mailboxId: string;
let businessId: string;

before(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });
});
after(async () => {
  await pglite.close();
});

beforeEach(async () => {
  await database.delete(schema.activity);
  await database.delete(messages);
  await database.delete(businesses);
  await database.delete(mailboxes);
  inboxBatch = { emails: [], resumeFrom: null };
  sentBatch = { emails: [], resumeFrom: null };
  inboxReads = 0;
  [{ id: mailboxId }] = await database.insert(mailboxes).values({ email: "cold@example.com", sealedRefreshToken: "x", connectedBy: "test", isSender: true }).returning({ id: mailboxes.id });
  [{ id: businessId }] = await database
    .insert(businesses)
    .values({ slug: "shop", linkCode: "abc123", businessName: "Shop", email: "owner@shop.example", stage: "sent", firstSentAt: new Date() })
    .returning({ id: businesses.id });
});

const reply = (gmailId: string, body: string, at: Date) => ({
  gmailId,
  threadId: `thread-${gmailId}`,
  headerMessageId: `<${gmailId}@shop.example>`,
  from: "owner@shop.example",
  to: "cold@example.com",
  subject: "Re: hello",
  body,
  at,
});

const savedMailbox = async () => (await database.select().from(mailboxes).where(eq(mailboxes.id, mailboxId)))[0];

describe("syncMail", () => {
  it("stores a reply and moves the lead to replied", async () => {
    inboxBatch = { emails: [reply("r1", "No thanks, remove me.", new Date())], resumeFrom: null };
    const result = await syncMail();
    assert.equal(result.newMessages, 1);
    const [lead] = await database.select().from(businesses).where(eq(businesses.id, businessId));
    assert.equal(lead.stage, "replied");
  });

  it("starts the next run where this run stopped when older mail is still unread", async () => {
    const resumeFrom = new Date("2026-01-01T12:00:00Z");
    inboxBatch = { emails: [reply("r1", "hello", new Date("2026-01-01T12:00:01Z"))], resumeFrom };
    sentBatch = { emails: [], resumeFrom: new Date("2026-01-01T11:00:00Z") };
    await syncMail();
    const mailbox = await savedMailbox();
    assert.equal(mailbox.lastSyncedAt?.getTime(), resumeFrom.getTime());
    assert.equal(mailbox.lastSentSyncedAt?.getTime(), new Date("2026-01-01T11:00:00Z").getTime());
  });

  it("moves to the time of the run once everything is read", async () => {
    const before = Date.now();
    await syncMail();
    const mailbox = await savedMailbox();
    assert.ok((mailbox.lastSyncedAt?.getTime() ?? 0) >= before - 1000);
  });

  it("reads Gmail once when two bots ask for fresh mail at the same time", async () => {
    await Promise.all([syncMailIfStale(0), syncMailIfStale(0)]);
    assert.equal(inboxReads, 1);
  });
});
