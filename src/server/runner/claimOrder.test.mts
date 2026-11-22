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
const { buildsToday, requestPreview, runNext } = await import("./jobs");
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
  await requestPreview(noted, "bot:outreach", "The owner asked for a new look.");
  const old = await builtLead();
  await requestPreview(old, "admin", POINTING_NOTE);
  const fresh = await lead();
  assert.equal((await ask())?.lead.id, old.id, "another bot's request is built the long way, so it waits for tomorrow, designs don't");
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
  await store.redrawBoards(board.id, "Fonts too basic.", "boris.nezlobin@gmail.com", { base: "c" });
  const claim = await ask();
  assert.equal(claim?.lead.id, owner.id, "Boris's revision, not the older update for another lead");
  assert.deepEqual(claim?.boardsAgain, { feedback: "Fonts too basic.", by: "Boris", base: "c", board: board.id });
  assert.equal(claim?.job.note, NEW_DESIGN_NOTE, "it carries the note behind the boards, not the kit update's");
});

test("three new designs with a selected option, and Redraw all, are drawn past the cap like any redraw", async () => {
  await updateRunnerSettings({ dailyCap: 0, mostDesignsWaiting: 1 }, "one@example.com");
  const store = await import("../boards/store");
  const selected = await redesignedLead();
  await requestPreview(selected.owner, "boris.nezlobin@gmail.com", NEW_DESIGN_NOTE);
  await store.redrawBoards(selected.board.id, "B feels the most sophisticated, but its serif is too plain.", "boris.nezlobin@gmail.com", { selected: "b" });
  const first = await ask();
  assert.equal(first?.lead.id, selected.owner.id);
  assert.deepEqual(first?.boardsAgain, { feedback: "B feels the most sophisticated, but its serif is too plain.", by: "Boris", selected: "b", board: selected.board.id });

  const replaced = await redesignedLead();
  await requestPreview(replaced.owner, "boris.nezlobin@gmail.com", NEW_DESIGN_NOTE);
  await store.redrawWaiting("boris.nezlobin@gmail.com");
  const second = await ask();
  assert.equal(second?.lead.id, replaced.owner.id, "Redraw all's jobs are not held back by the daily cap");
  assert.deepEqual(second?.boardsAgain, { feedback: "", by: "Boris", replaced: true, board: replaced.board.id });
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

type RepairClaim = Claim & { repair?: boolean };

async function claimed(jobId: string) {
  const [job] = await database.select().from(previewJobs).where(eq(previewJobs.id, jobId));
  return job;
}

test("a repair goes past the daily cap, is kept as a repair, and doesn't use up a build", async () => {
  await updateRunnerSettings({ dailyCap: 1, designBoards: false }, "one@example.com");
  const site = await lead();
  const first = await ask();
  assert.equal(first?.lead.id, site.id, "a new site uses the day's one build");
  assert.equal((await claimed(first!.job.id)).repair, false);
  assert.equal(await buildsToday(), 1);

  const noted = await builtLead();
  await requestPreview(noted, "designer@example.com", "The phone number is wrong.");
  await lead();
  const repair = (await ask()) as RepairClaim | null;
  assert.equal(repair?.lead.id, noted.id, "the designer's notes are repaired past the cap");
  assert.equal(repair?.repair, true);
  assert.equal((await claimed(repair!.job.id)).repair, true, "the job keeps that it was a repair");
  assert.equal(await buildsToday(), 1, "a repair is not a new site");
  assert.equal(await ask(), null, "the new lead still waits for tomorrow");
});

test("the repair decision kept on the job stands when the lead's preview changes later", async () => {
  await updateRunnerSettings({ dailyCap: 5, designBoards: false }, "one@example.com");
  const noted = await builtLead();
  await requestPreview(noted, "brendan@g.studio", "Make the hours bigger.");
  const repair = await ask();
  await database.update(businesses).set({ previewUrl: "" }).where(eq(businesses.id, noted.id));
  assert.equal((await claimed(repair!.job.id)).repair, true);
  assert.equal(await buildsToday(), 0);
});

test("a retry of a failed repair is a repair, and a retry of a new site counts like the site", async () => {
  await updateRunnerSettings({ dailyCap: 0, designBoards: false }, "one@example.com");
  const { RETRY_NOTE, RUNNER_ACTOR } = await import("@/lib/previewJobs");
  const noted = await builtLead();
  await requestPreview(noted, RUNNER_ACTOR, ["The phone number is wrong.", RETRY_NOTE].join("\n\n"));
  const fresh = await lead();
  await requestPreview(fresh, RUNNER_ACTOR, RETRY_NOTE);
  assert.equal((await ask())?.lead.id, noted.id, "the retried repair goes past the cap");
  assert.equal(await ask(), null, "the retried new site waits for tomorrow");
});

test("Claude's usage pause stops repairs too", async () => {
  await updateRunnerSettings({ dailyCap: 0, pausedUntil: new Date(Date.now() + 3_600_000).toISOString() }, "one@example.com");
  await requestPreview(await builtLead(), "brendan@g.studio", "The phone number is wrong.");
  assert.equal(await ask(), null);
});
