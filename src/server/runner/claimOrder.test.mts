/**
 * The order the runner is handed work in: what a founder waits on, then designs to review, and builds only within the cap.
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
const { businesses, designBoards, previewJobs } = await import("../db/schema");
const { requestPreview, runNext } = await import("./jobs");
const { claimNext } = await import("./api");
const { updateRunnerSettings } = await import("./settings");
const { POINTING_NOTE } = await import("@/lib/review");
const { NEW_DESIGN_NOTE } = await import("@/lib/previewJobs");
const database = await db();

type Claim = { job: { id: string; note: string }; lead: { id: string; slug: string }; boards?: boolean; boardsAgain?: unknown; board?: unknown };

let made = 0;
async function lead(fields: Record<string, unknown> = {}) {
  made += 1;
  const [row] = await database
    .insert(businesses)
    .values({ businessName: `Lead ${made}`, slug: `order-${made}`, linkCode: `order-${made}`, website: `https://order-${made}.example`, email: `owner@order-${made}.example`, ...fields } as never)
    .returning();
  return row;
}

const builtLead = () => lead({ previewUrl: `https://old-${made + 1}.vercel.app`, stage: "preview_built", previewRequestedAt: new Date() });

async function ask(): Promise<Claim | null> {
  const answer = await claimNext({ name: "runner-1" } as never, new Request("https://defect.tech/api/runner/next?runner=runner-order"));
  if (answer instanceof Response) return null;
  const claim = answer as Claim;
  await database.update(previewJobs).set({ status: "done", finishedAt: new Date() }).where(eq(previewJobs.id, claim.job.id));
  return claim;
}

async function waitingDesigns(count: number) {
  for (let index = 0; index < count; index++) {
    const owner = await builtLead();
    const [job] = await database.insert(previewJobs).values({ businessId: owner.id, requestedBy: "auto-queue", status: "done" }).returning();
    await database.insert(designBoards).values({ businessId: owner.id, jobId: job.id, options: [], pick: "a" } as never);
  }
}

beforeEach(async () => {
  await database.delete(designBoards);
  await database.delete(previewJobs);
  // Earlier tests' leads stay, out of the runner's reach, since the activity log points at them.
  await database.update(businesses).set({ stage: "lost" });
  await updateRunnerSettings({ dailyCap: 10, autoQueue: true, designBoards: true, mostDesignsWaiting: 20, pausedUntil: null }, "one@example.com");
});

test("an unreviewed preview queued for a kit-only update gets three new designs, before new leads", async () => {
  const old = await builtLead();
  await requestPreview(old, "admin", POINTING_NOTE);
  const fresh = await lead();
  const first = await ask();
  assert.equal(first?.lead.id, old.id);
  assert.equal(first?.job.note, NEW_DESIGN_NOTE, "the builder is asked for a new design, not the old one on a newer kit");
  assert.equal(first?.boards, true);
  const second = await ask();
  assert.equal(second?.lead.id, fresh.id);
  assert.equal(second?.boards, true, "a first build stops at its three designs");
});

test("a founder's note goes before new designs", async () => {
  await lead();
  const noted = await builtLead();
  await requestPreview(noted, "brendan@g.studio", "The phone number is wrong.");
  assert.equal((await ask())?.lead.id, noted.id);
});

test("designs go on past the daily cap, and builds stop at it", async () => {
  await updateRunnerSettings({ dailyCap: 0 }, "one@example.com");
  const noted = await builtLead();
  await requestPreview(noted, "brendan@g.studio", "The phone number is wrong.");
  const old = await builtLead();
  await requestPreview(old, "admin", POINTING_NOTE);
  const fresh = await lead();
  assert.equal((await ask())?.lead.id, old.id, "the note's build waits for tomorrow, designs don't");
  assert.equal((await ask())?.lead.id, fresh.id);
  assert.equal(await ask(), null);
});

test("Claude's usage pause stops designs too", async () => {
  await updateRunnerSettings({ pausedUntil: new Date(Date.now() + 3_600_000).toISOString() }, "one@example.com");
  await lead();
  assert.equal(await ask(), null);
});

test("with design boards off, the daily cap stops new leads too", async () => {
  await updateRunnerSettings({ dailyCap: 0, designBoards: false }, "one@example.com");
  await lead();
  assert.equal(await ask(), null);
});

test("new designs stop once as many wait for a choice as Setup allows, and the runner is told so", async () => {
  await updateRunnerSettings({ mostDesignsWaiting: 2, dailyCap: 0 }, "one@example.com");
  await waitingDesigns(2);
  await requestPreview(await builtLead(), "admin", POINTING_NOTE);
  await lead();
  assert.equal(await ask(), null);
  const answer = (await claimNext({ name: "runner-1" } as never, new Request("https://defect.tech/api/runner/next?runner=runner-order"))) as Response;
  assert.equal(answer.headers.get("X-Runner-Reason"), "2 designs wait for a founder's choice, as many as Setup > Bots allows, so no new ones are drawn.", "not the daily cap");
});

test("with design boards off, a new lead is built before a kit-only update, which keeps its design", async () => {
  await updateRunnerSettings({ designBoards: false }, "one@example.com");
  const old = await builtLead();
  await requestPreview(old, "admin", POINTING_NOTE);
  const fresh = await lead();
  assert.equal((await ask())?.lead.id, fresh.id);
  const update = await ask();
  assert.equal(update?.lead.id, old.id);
  assert.equal(update?.job.note, POINTING_NOTE);
});

/** A lead whose old preview got new designs, which wait for a choice: the boards job carried "Start a new design." */
async function redesignedLead() {
  const owner = await builtLead();
  const [boardsJob] = await database.insert(previewJobs).values({ businessId: owner.id, requestedBy: "admin", note: NEW_DESIGN_NOTE, status: "done" }).returning();
  const options = ["a", "b", "c"].map((letter) => ({ letter, name: `Direction ${letter}` }));
  const [board] = await database.insert(designBoards).values({ businessId: owner.id, jobId: boardsJob.id, options, pick: null } as never).returning();
  return { owner, board };
}

test("a revision of a lead whose kit-only update was queued before it is drawn first, past the cap and the designs waiting", async () => {
  await updateRunnerSettings({ dailyCap: 0, mostDesignsWaiting: 1 }, "one@example.com");
  const { owner, board } = await redesignedLead();
  await requestPreview(await builtLead(), "admin", POINTING_NOTE);
  // As happened on Nov 15: the Review page had queued the lead's kit update again, then Boris revised its design.
  await database.insert(previewJobs).values({ businessId: owner.id, requestedBy: "admin", note: POINTING_NOTE, createdAt: new Date(Date.now() + 1000) });
  const store = await import("../boards/store");
  await store.redrawBoards(board.id, "Fonts too basic.", "boris.nezlobin@gmail.com", "c");
  const claim = await ask();
  assert.equal(claim?.lead.id, owner.id, "Boris's revision, not the older update for another lead");
  assert.deepEqual(claim?.boardsAgain, { feedback: "Fonts too basic.", by: "Boris", base: "c", board: board.id });
  assert.equal(claim?.job.note, NEW_DESIGN_NOTE, "it carries the note behind the boards, not the kit update's");
});

test("a founder's decision takes over a kit-only update queued for the same lead, and a lead with boards is never queued one again", async () => {
  const { owner } = await redesignedLead();
  const queued = await requestPreview(owner, "admin", POINTING_NOTE);
  const taken = await requestPreview(owner, "boris.nezlobin@gmail.com", NEW_DESIGN_NOTE);
  assert.equal(taken.job.id, queued.job.id);
  assert.equal(taken.created, true);
  assert.equal(taken.job.note, NEW_DESIGN_NOTE);
  assert.equal(taken.job.requestedBy, "boris.nezlobin@gmail.com");
  const again = await requestPreview(owner, "admin", POINTING_NOTE);
  assert.equal(again.created, false, "an update never takes over a founder's job");

  await database.update(previewJobs).set({ status: "done" });
  await database.update(previewJobs).set({ startedAt: new Date("2026-10-12T00:00:00Z"), previewUrl: owner.previewUrl }).where(eq(previewJobs.businessId, owner.id));
  const { queuePointingUpdates } = await import("../review/pointingUpdates");
  const plain = await builtLead();
  await database.insert(previewJobs).values({ businessId: plain.id, requestedBy: "auto-queue", status: "done", previewUrl: plain.previewUrl, startedAt: new Date("2026-10-12T00:00:00Z") });
  const item = (lead: typeof owner) => ({ id: lead.id, businessName: lead.businessName, website: lead.website, previewUrl: lead.previewUrl, stage: lead.stage, previewBuiltAt: null, niche: "", area: "" });
  assert.equal(await queuePointingUpdates([item(owner), item(plain)]), 1, "only the lead without boards gets the update");
});

test("a founder can have a queued build taken next, and one that already started stays where it is", async () => {
  const leads = [await builtLead(), await builtLead(), await builtLead()];
  const jobs = [];
  for (const each of leads) jobs.push((await requestPreview(each, "boris.nezlobin@gmail.com", "Make the hours bigger.")).job);
  assert.equal(await runNext(jobs[2].id), true);
  assert.deepEqual([(await ask())?.lead.id, (await ask())?.lead.id, (await ask())?.lead.id], [leads[2].id, leads[0].id, leads[1].id]);
  assert.equal(await runNext(jobs[1].id), false, "it isn't queued any more");
});
