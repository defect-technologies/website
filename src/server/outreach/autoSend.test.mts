/**
 * Which emails the admin sends on its own, and when.
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

let sentTo: string[] = [];
mock.module("../mail/outbox", {
  namedExports: {
    deliver: async (compose: (from: null) => { to: string; from: { email: string }; subject: string; body: string }) => {
      const email = compose(null);
      sentTo.push(email.to);
      return { gmailId: `g-${sentTo.length}`, threadId: `t-${sentTo.length}`, headerMessageId: `<${sentTo.length}@x>`, mailbox: null, email };
    },
    connectedMailboxes: async () => [],
    sendingMailbox: async () => null,
    NoSendingInbox: class extends Error {},
  },
});

const pglite = new PGlite();
const database = drizzle(pglite, { schema });
(globalThis as { defectDb?: Promise<unknown> }).defectDb = Promise.resolve(database);

const { sendNextApprovedEmail, withinSendingHours, AUTO_SENDER_EMAIL } = await import("./autoSend");
const { saveOutreachSettings } = await import("../settings");
const { DEFAULT_SETTINGS } = await import("@/lib/emailTemplate");

const { activity, businesses, messages, previewReviews } = schema;
const settings = { ...DEFAULT_SETTINGS, mailingAddress: "1 Main St, Los Angeles, CA", senderName: "Brendan Giang", dailyLimit: 10, autoSend: true };

/** Tuesday, Nov 24, 2026, 10:30 AM in Los Angeles. */
const TUESDAY_MORNING = new Date("2026-11-24T18:30:00Z");

async function addLead(slug: string, email: string) {
  const [{ id }] = await database
    .insert(businesses)
    .values({ slug, linkCode: `code-${slug}`, businessName: slug, email, previewUrl: `https://${slug}.preview.example`, priceArm: 59, problemSummary: "the site is slow", stage: "preview_built" })
    .returning({ id: businesses.id });
  return id;
}

const approve = (businessId: string, slug: string) =>
  database.insert(previewReviews).values({ businessId, previewUrl: `https://${slug}.preview.example`, verdict: "approved", reviewedBy: "brendan@g.studio" });

before(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });
});
after(async () => {
  await pglite.close();
});

beforeEach(async () => {
  sentTo = [];
  await saveOutreachSettings(settings, "test");
  await database.delete(activity);
  await database.delete(messages);
  await database.delete(previewReviews);
  await database.delete(businesses);
});

describe("sending hours", () => {
  it("sends on a weekday morning in Los Angeles", () => assert.equal(withinSendingHours(TUESDAY_MORNING), true));
  it("waits through the night", () => assert.equal(withinSendingHours(new Date("2026-11-25T06:00:00Z")), false));
  it("waits through the weekend", () => assert.equal(withinSendingHours(new Date("2026-11-28T18:30:00Z")), false));
});

describe("sendNextApprovedEmail", () => {
  it("sends nothing while the switch is off", async () => {
    await saveOutreachSettings({ ...settings, autoSend: false }, "test");
    await approve(await addLead("shop", "owner@shop.example"), "shop");
    assert.ok("skipped" in (await sendNextApprovedEmail(TUESDAY_MORNING)));
    assert.deepEqual(sentTo, []);
  });

  it("emails only the preview a founder approved", async () => {
    await addLead("unseen", "owner@unseen.example");
    const approvedId = await addLead("liked", "owner@liked.example");
    await approve(approvedId, "liked");
    const outcome = await sendNextApprovedEmail(TUESDAY_MORNING);
    assert.ok("sent" in outcome);
    assert.deepEqual(sentTo, ["owner@liked.example"]);
    const [message] = await database.select().from(messages).where(eq(messages.businessId, approvedId));
    assert.equal(message.sentBy, AUTO_SENDER_EMAIL);
  });

  it("does not email an approval of an older preview", async () => {
    const id = await addLead("rebuilt", "owner@rebuilt.example");
    await database.insert(previewReviews).values({ businessId: id, previewUrl: "https://old.preview.example", verdict: "approved", reviewedBy: "brendan@g.studio" });
    await sendNextApprovedEmail(TUESDAY_MORNING);
    assert.deepEqual(sentTo, []);
  });

  it("sends one email a run and spaces the next one out", async () => {
    await approve(await addLead("one", "owner@one.example"), "one");
    await approve(await addLead("two", "owner@two.example"), "two");
    await sendNextApprovedEmail(TUESDAY_MORNING);
    await database.update(messages).set({ at: TUESDAY_MORNING });
    await sendNextApprovedEmail(new Date(TUESDAY_MORNING.getTime() + 5 * 60_000));
    assert.equal(sentTo.length, 1);
    await sendNextApprovedEmail(new Date(TUESDAY_MORNING.getTime() + 25 * 60_000));
    assert.equal(sentTo.length, 2);
  });
});
