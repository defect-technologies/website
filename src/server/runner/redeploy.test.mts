/**
 * Previews the daily cleanup deleted: no email links to one, Review leaves it out, and the runner puts it back up.
 *
 *   npm test
 *
 * Runs against an in-memory Postgres (PGlite) migrated from drizzle/.
 */
import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
import { startEmptyTestDatabase } from "../emptyTestDatabase";

mock.module("server-only", { namedExports: {} });
process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";

const closeDatabase = await startEmptyTestDatabase();
after(closeDatabase);
const { eq } = await import("drizzle-orm");
const { db } = await import("../db/client");
const { businesses, previewJobs, previewReviews } = await import("../db/schema");
const { claimNext, reportDone } = await import("./api");
const { expiredPreviewIds, oldPreviewsToPutBack } = await import("../leads/previewExpiry");
const { reviewQueue } = await import("../review/queue");
const { leadStatus } = await import("@/lib/leadStatus");
const { NEW_DESIGN_NOTE } = await import("@/lib/previewJobs");
const database = await db();

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

let made = 0;

/** A lead whose preview the runner built and deployed this many days ago. */
async function builtLead(days: number, fields: Record<string, unknown> = {}) {
  made += 1;
  const previewUrl = `https://old-${made}.vercel.app`;
  const [lead] = await database
    .insert(businesses)
    .values({ businessName: `Lead ${made}`, slug: `put-back-${made}`, linkCode: `put-back-${made}`, website: `https://lead-${made}.example`, email: `owner@lead-${made}.example`, stage: "preview_built", previewUrl, previewBuiltAt: daysAgo(days), previewRequestedAt: daysAgo(days), ...fields } as never)
    .returning();
  await database.insert(previewJobs).values({ businessId: lead.id, requestedBy: "auto-queue", status: "done", previewUrl, createdAt: daysAgo(days), finishedAt: daysAgo(days) });
  return lead;
}

type Claim = { job: { id: string; kind: string }; lead: { id: string }; redeploy?: { previewUrl: string } };

async function ask(can = "can=launch&can=redeploy"): Promise<Claim | null> {
  const answer = await claimNext({ name: "runner-1" } as never, new Request(`https://defect.tech/api/runner/next?runner=runner-put-back&${can}`));
  return answer instanceof Response ? null : (answer as Claim);
}

beforeEach(async () => {
  await database.delete(previewReviews);
  await database.delete(previewJobs);
  await database.update(businesses).set({ stage: "lost" });
});

test("a preview past the cleanup's age is expired: not sendable, not on Review, and shown as expired", async () => {
  const old = await builtLead(40);
  const fresh = await builtLead(5);
  const expired = await expiredPreviewIds();
  assert.ok(expired.has(old.id));
  assert.ok(!expired.has(fresh.id));
  const reviewed = (await reviewQueue()).map((item) => item.id);
  assert.ok(reviewed.includes(fresh.id) && !reviewed.includes(old.id));
  assert.equal(leadStatus("preview_built", "done", "", true), "preview_expired");
  assert.equal(leadStatus("sent", "done", "", true), "waiting");
});

test("a paying client's old preview isn't expired, since the cleanup keeps it", async () => {
  const paid = await builtLead(40, { stage: "paid", paidAt: daysAgo(10) });
  assert.ok(!(await expiredPreviewIds()).has(paid.id));
});

test("the runner is handed an old preview to deploy again, but only a runner that says it can", async () => {
  const old = await builtLead(40);
  assert.equal((await ask("can=launch"))?.job.kind ?? "none", "none");
  const claim = await ask();
  assert.equal(claim?.job.kind, "redeploy");
  assert.equal(claim?.lead.id, old.id);
  assert.equal(claim?.redeploy?.previewUrl, old.previewUrl);
});

test("a redeploy moves the lead to its new address, keeps the founders' reviews, and the preview is no longer expired", async () => {
  const old = await builtLead(40);
  await database.insert(previewReviews).values({ businessId: old.id, previewUrl: old.previewUrl, verdict: "approved", reviewedBy: "a founder" });
  const claim = (await ask())!;
  await reportDone(claim.job.id, { status: "done", previewUrl: "https://new-copy.vercel.app", sameDesign: true } as never);
  const [lead] = await database.select().from(businesses).where(eq(businesses.id, old.id));
  assert.equal(lead.previewUrl, "https://new-copy.vercel.app");
  const reviews = await database.select().from(previewReviews).where(eq(previewReviews.previewUrl, "https://new-copy.vercel.app"));
  assert.equal(reviews.length, 1);
  assert.ok(!(await expiredPreviewIds()).has(old.id));
});

test("when the runner no longer has the site, a lead nobody emailed gets a new design", async () => {
  const old = await builtLead(40);
  const claim = (await ask())!;
  await reportDone(claim.job.id, { status: "failed", siteGone: true, logTail: "The site folder is gone." } as never);
  const jobs = await database.select().from(previewJobs).where(eq(previewJobs.businessId, old.id));
  const rebuild = jobs.find((job) => job.kind === "preview" && job.status === "queued");
  assert.equal(rebuild?.note, NEW_DESIGN_NOTE);
});

test("a redeploy that keeps failing is left for a founder after two tries", async () => {
  const old = await builtLead(40, { stage: "sent" });
  for (let attempt = 0; attempt < 2; attempt++) {
    const claim = (await ask())!;
    assert.equal(claim.lead.id, old.id);
    await reportDone(claim.job.id, { status: "failed", logTail: "Vercel answered 500." } as never);
  }
  assert.equal((await oldPreviewsToPutBack()).length, 0);
});
