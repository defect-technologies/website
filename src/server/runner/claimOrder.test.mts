/**
 * The order the runner is handed work in: what a founder waits on, then designs for new leads, then kit-only updates.
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
const { db } = await import("../db/client");
const { businesses, designBoards, previewJobs } = await import("../db/schema");
const { requestPreview } = await import("./jobs");
const { claimNext } = await import("./api");
const { updateRunnerSettings } = await import("./settings");
const { POINTING_NOTE } = await import("@/lib/review");
const database = await db();

type Claim = { job: { id: string; note: string }; lead: { id: string; slug: string }; boards?: boolean };

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
  await database.update(previewJobs).set({ status: "done", finishedAt: new Date() });
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

test("a new lead's designs come before the kit-only update of an old preview", async () => {
  await requestPreview(await builtLead(), "admin", POINTING_NOTE);
  const fresh = await lead();
  const first = await ask();
  assert.equal(first?.lead.id, fresh.id);
  assert.equal(first?.boards, true, "a first build stops at its three designs");
});

test("a founder's note goes before new designs", async () => {
  await lead();
  const noted = await builtLead();
  await requestPreview(noted, "brendan@g.studio", "The phone number is wrong.");
  assert.equal((await ask())?.lead.id, noted.id);
});

test("designs for new leads go on past the daily cap, and builds stop at it", async () => {
  await updateRunnerSettings({ dailyCap: 0 }, "one@example.com");
  const noted = await builtLead();
  await requestPreview(noted, "brendan@g.studio", "The phone number is wrong.");
  const fresh = await lead();
  const claim = await ask();
  assert.equal(claim?.lead.id, fresh.id, "the note's build waits for tomorrow, the new lead's designs don't");
  assert.equal(claim?.boards, true);
});

test("with design boards off, the daily cap stops new leads too", async () => {
  await updateRunnerSettings({ dailyCap: 0, designBoards: false }, "one@example.com");
  await lead();
  assert.equal(await ask(), null);
});

test("new designs stop once as many wait for a choice as Setup allows", async () => {
  await updateRunnerSettings({ mostDesignsWaiting: 2 }, "one@example.com");
  await waitingDesigns(2);
  await lead();
  assert.equal(await ask(), null, "no new lead, and no kit-only update while designs wait for a choice");
});

test("kit-only updates fill a runner with nothing else to do", async () => {
  const old = await builtLead();
  await requestPreview(old, "admin", POINTING_NOTE);
  const claim = await ask();
  assert.equal(claim?.lead.id, old.id);
  assert.equal(claim?.job.note, POINTING_NOTE);
});
