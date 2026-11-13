/**
 * The emails that tell the founders it is their turn, and how soon an idle runner is told to ask again.
 *
 *   npm test
 *
 * Runs against an in-memory Postgres (PGlite) migrated from drizzle/.
 */
import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { startEmptyTestDatabase } from "../emptyTestDatabase";

mock.module("server-only", { namedExports: {} });
process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";
process.env.BRAND_FILES_READ_WRITE_TOKEN = "vercel_blob_rw_TestStore_secret";
process.env.ADMIN_EMAILS = "one@example.com, two@example.com";
process.env.SITE_URL = "https://admin.example";
const STORE = "https://teststore.public.blob.vercel-storage.com";

const closeDatabase = await startEmptyTestDatabase();
after(closeDatabase);

const sent: { subject: string; body: string }[] = [];
const notify = await import("../flags/notify");
mock.module("../flags/notify", {
  namedExports: {
    ...notify,
    emailFounders: async (subject: string, body: string) => {
      sent.push({ subject, body });
    },
  },
});

const { db } = await import("../db/client");
const { businesses, previewJobs } = await import("../db/schema");
const { claimNext, reportDone } = await import("./api");
const { BoardsBody, reportBoards } = await import("./boards");
const { updateRunnerSettings } = await import("./settings");
const { tellFounders } = await import("./tellFounders");
const { POINTING_NOTE } = await import("@/lib/review");
const database = await db();

let made = 0;
async function leadWithRunningJob(name: string, lead: Record<string, unknown> = {}, note = "") {
  made += 1;
  const [business] = await database.insert(businesses).values({ businessName: name, slug: `turn-${made}`, linkCode: `turn-${made}`, website: `https://turn-${made}.example`, ...lead } as never).returning();
  const [job] = await database.insert(previewJobs).values({ businessId: business.id, kind: "preview", status: "running", requestedBy: "test", note }).returning();
  return { lead: business, job };
}

function threeOptions(businessId: string) {
  const picture = (letter: string, view: string) => `${STORE}/boards/${businessId}/job/${letter}-${view}-x1.jpg`;
  return ["a", "b", "c"].map((letter) => ({
    letter,
    name: `Direction ${letter}`,
    palette: { background: "#faf3e3", accent: "#b23c17" },
    fonts: { heading: "Zilla Slab", body: "DM Sans" },
    layout: "split-hero",
    controls: { shape: "square", fill: "solid", case: "sentence", weight: "bold", link: "underline" },
    motif: { name: "Sunburst", from: "Their logo." },
    pictures: { board: picture(letter, "board"), desktop: picture(letter, "desktop"), phone: picture(letter, "phone") },
  }));
}

const lastEmail = () => sent[sent.length - 1];

test("three designs that wait for a choice are emailed to the founders, with the link to choose", async () => {
  const { lead, job } = await leadWithRunningJob("Acme Heating");
  const { board } = await reportBoards(job.id, BoardsBody.parse({ options: threeOptions(lead.id) }));
  assert.equal(sent.length, 1);
  assert.equal(lastEmail().subject, "Choose a design for Acme Heating");
  assert.match(lastEmail().body, /A\. Direction a\nB\. Direction b\nC\. Direction c/);
  assert.ok(lastEmail().body.includes(`Choose one: https://admin.example/admin/designs/${board}`));
});

test("a built site that waits for a look is emailed, and the email says why it waits", async () => {
  const first = await leadWithRunningJob("Built Plumbing");
  await reportDone(first.job.id, { status: "done", previewUrl: "https://built-1.vercel.app" });
  assert.equal(lastEmail().subject, "Review the site for Built Plumbing");
  assert.equal(lastEmail().body, `The site for Built Plumbing is built.\n\nReview it: https://admin.example/admin/review?id=${first.lead.id}`);

  const held = await leadWithRunningJob("Held Electric", {}, "On / at phone width, the <h1>: too large.");
  await reportDone(held.job.id, { status: "done", previewUrl: "https://held-1.vercel.app", criticVerdict: "Revise: cosmetic findings left" });
  assert.match(lastEmail().body, /^The site for Held Electric is rebuilt with the changes its note asked for\./);
  assert.match(lastEmail().body, /stays out of outreach until one of you approves it/);

  const shown = await leadWithRunningJob("Shown Dental", { stage: "sent", previewUrl: "https://shown-1.vercel.app" }, "Use the owner's new photo.");
  await reportDone(shown.job.id, { status: "done", previewUrl: "https://shown-2.vercel.app" });
  assert.match(lastEmail().body, /The owner still sees the earlier preview until one of you approves this one\./);
  assert.match(lastEmail().body, /Review it: https:\/\/admin\.example\/admin$/, "its flag is answered on Today");

  const pointed = await leadWithRunningJob("Pointed Roofing", { previewUrl: "https://pointed-1.vercel.app" }, POINTING_NOTE);
  await reportDone(pointed.job.id, { status: "done", previewUrl: "https://pointed-2.vercel.app" });
  assert.match(lastEmail().body, /^The preview for Pointed Roofing is updated\. You can now point at its parts\./);
});

test("a build that failed or was skipped sends no email", async () => {
  const before = sent.length;
  const failed = await leadWithRunningJob("Failed Florist");
  await reportDone(failed.job.id, { status: "failed", logTail: "npm install failed three times" });
  assert.equal(sent.length, before);
});

test("the founders can switch the emails off, and a report is kept when an email can't be sent", async () => {
  const before = sent.length;
  await updateRunnerSettings({ tellFounders: false }, "one@example.com");
  const quiet = await leadWithRunningJob("Quiet Bakery");
  await reportDone(quiet.job.id, { status: "done", previewUrl: "https://quiet-1.vercel.app" });
  assert.equal(sent.length, before, "switched off");
  assert.equal(await tellFounders(() => ({ subject: "s", body: "b" })), false);
  await updateRunnerSettings({ tellFounders: true }, "one@example.com");

  const errors = mock.method(console, "error", () => {});
  const down = async () => {
    throw new Error("mail is down");
  };
  assert.equal(await tellFounders(() => ({ subject: "s", body: "b" }), down), false, "it reports the failure and does not throw");
  assert.equal(errors.mock.callCount(), 1);
  errors.mock.restore();

  process.env.ADMIN_EMAILS = "";
  assert.equal(await tellFounders(() => ({ subject: "s", body: "b" })), false, "nobody to tell");
  process.env.ADMIN_EMAILS = "one@example.com, two@example.com";
  assert.equal(await tellFounders(() => ({ subject: "s", body: "b" })), true);
});

test("an idle runner is told to ask again in a minute, except on a database that bills by the minute awake", async () => {
  await database.update(previewJobs).set({ status: "done" });
  await updateRunnerSettings({ autoQueue: false }, "one@example.com");
  const ask = () => claimNext({ name: "runner-1" } as never, new Request("https://admin.example/api/runner/next")) as Promise<Response>;
  const previous = process.env.DATABASE_URL;

  process.env.DATABASE_URL = "postgres://user:secret@aws-0-us-west-1.pooler.supabase.com:5432/postgres";
  const onSupabase = await ask();
  assert.equal(onSupabase.status, 204);
  assert.equal(onSupabase.headers.get("X-Runner-Ask-Again"), "60");

  process.env.DATABASE_URL = "postgres://user:secret@ep-quiet-1.us-west-2.aws.neon.tech/neondb";
  const onNeon = await ask();
  assert.equal(onNeon.status, 204);
  assert.equal(onNeon.headers.get("X-Runner-Ask-Again"), null, "the runner keeps to its two wake minutes an hour");

  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
});
