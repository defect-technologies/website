/**
 * Your turn: the one queue of what waits for a founder's taste.
 *
 *   npm test
 *
 * Runs against an in-memory Postgres (PGlite) migrated from drizzle/.
 */
import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { startEmptyTestDatabase } from "./emptyTestDatabase";

mock.module("server-only", { namedExports: {} });
process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";

const closeDatabase = await startEmptyTestDatabase();
after(closeDatabase);

const { db } = await import("./db/client");
const { businesses, designBoards, previewJobs, previewReviews } = await import("./db/schema");
const { nextTurnHref, turns } = await import("./turn");
const database = await db();

let made = 0;
async function lead(name: string, values: Record<string, unknown> = {}) {
  made += 1;
  const [row] = await database.insert(businesses).values({ businessName: name, slug: `turn-${made}`, linkCode: `turn-${made}`, website: `https://turn-${made}.example`, ...values } as never).returning();
  return row;
}

test("with nothing waiting the queue is its own page", async () => {
  assert.deepEqual(await turns(), []);
  assert.equal(await nextTurnHref(), "/admin/turn");
});

test("the queue takes a repaired site first, then a design, then a site nobody has looked at, and drops each once it is decided", async () => {
  const fresh = await lead("New Dental", { stage: "preview_built", previewUrl: "https://new-1.vercel.app", previewBuiltAt: new Date() });
  const repaired = await lead("Repaired Roofing", { stage: "preview_built", previewUrl: "https://repaired-2.vercel.app", previewBuiltAt: new Date(Date.now() - 60_000) });
  await database.insert(previewJobs).values({ businessId: repaired.id, status: "done", requestedBy: "one@example.com", previewUrl: "https://repaired-2.vercel.app", finishedAt: new Date(), result: { repairs: [{ id: "n1" }] } });
  await database.insert(previewJobs).values({ businessId: fresh.id, status: "done", requestedBy: "auto-queue", previewUrl: "https://new-1.vercel.app", finishedAt: new Date() });
  const waiting = await lead("Waiting Bakery");
  const [boardsJob] = await database.insert(previewJobs).values({ businessId: waiting.id, status: "done", requestedBy: "auto-queue", finishedAt: new Date() }).returning();
  const [board] = await database.insert(designBoards).values({ businessId: waiting.id, jobId: boardsJob.id, options: [] }).returning();

  assert.deepEqual((await turns()).map((turn) => [turn.kind, turn.businessName]), [["repair", "Repaired Roofing"], ["design", "Waiting Bakery"], ["review", "New Dental"]]);
  assert.equal(await nextTurnHref(), `/admin/review?id=${repaired.id}`);

  await database.insert(previewReviews).values({ businessId: repaired.id, previewUrl: "https://repaired-2.vercel.app", verdict: "approved", reviewedBy: "one@example.com" });
  assert.equal(await nextTurnHref(), `/admin/designs/${board.id}`, "the repair is approved, so the design is next");

  const { chooseBoard } = await import("./boards/store");
  await chooseBoard(board.id, "a", "", "one@example.com");
  assert.equal(await nextTurnHref(), `/admin/designs/${board.id}`, "a board with no option a can't be chosen from, so it still waits");
  await database.update(designBoards).set({ chosenLetter: "a", chosenAt: new Date(), chosenBy: "one@example.com" });
  assert.equal(await nextTurnHref(), `/admin/review?id=${fresh.id}`);
});
