/**
 * To do: the one queue of what waits for a founder's taste.
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
const { turns } = await import("./turn");
const database = await db();

let made = 0;
async function lead(name: string, values: Record<string, unknown> = {}) {
  made += 1;
  const [row] = await database.insert(businesses).values({ businessName: name, slug: `turn-${made}`, linkCode: `turn-${made}`, website: `https://turn-${made}.example`, ...values } as never).returning();
  return row;
}

const listed = async () => (await turns()).map((turn) => [turn.kind, turn.businessName]);

test("with nothing waiting the list is empty", async () => {
  assert.deepEqual(await turns(), []);
});

test("the list takes a repaired site first, then a design, then a site nobody has looked at, and drops each once it is decided", async () => {
  const fresh = await lead("New Dental", { stage: "preview_built", previewUrl: "https://new-1.vercel.app", previewBuiltAt: new Date() });
  const repaired = await lead("Repaired Roofing", { stage: "preview_built", previewUrl: "https://repaired-2.vercel.app", previewBuiltAt: new Date(Date.now() - 60_000) });
  await database.insert(previewJobs).values({ businessId: repaired.id, status: "done", requestedBy: "one@example.com", previewUrl: "https://repaired-2.vercel.app", finishedAt: new Date(), result: { repairs: [{ id: "n1" }] } });
  await database.insert(previewJobs).values({ businessId: fresh.id, status: "done", requestedBy: "auto-queue", previewUrl: "https://new-1.vercel.app", finishedAt: new Date() });
  const waiting = await lead("Waiting Bakery");
  const [boardsJob] = await database.insert(previewJobs).values({ businessId: waiting.id, status: "done", requestedBy: "auto-queue", finishedAt: new Date() }).returning();
  const desktop = (letter: string) => `https://store.example/boards/${letter}-desktop.jpg`;
  const options = ["a", "b", "c"].map((letter) => ({ letter, pictures: { desktop: desktop(letter), phone: "", board: "" } }));
  const [board] = await database.insert(designBoards).values({ businessId: waiting.id, jobId: boardsJob.id, options } as never).returning();

  assert.deepEqual(await listed(), [["repair", "Repaired Roofing"], ["design", "Waiting Bakery"], ["review", "New Dental"]]);
  const [first, design] = await turns();
  assert.equal(first.href, `/admin/review?id=${repaired.id}`);
  assert.equal(first.previewUrl, "https://repaired-2.vercel.app");
  assert.equal(design.href, `/admin/designs/${board.id}`);
  assert.deepEqual(design.firstScreens, [desktop("a"), desktop("b"), desktop("c")]);

  await database.insert(previewReviews).values({ businessId: repaired.id, previewUrl: "https://repaired-2.vercel.app", verdict: "approved", reviewedBy: "one@example.com" });
  assert.deepEqual(await listed(), [["design", "Waiting Bakery"], ["review", "New Dental"]], "the repair is approved");

  await database.update(designBoards).set({ chosenLetter: "a", chosenAt: new Date(), chosenBy: "one@example.com" });
  assert.deepEqual(await listed(), [["review", "New Dental"]]);
});

test("a preview the runner didn't build, such as one deployed by hand, is not listed for review", async () => {
  await database.update(businesses).set({ stage: "lost" });
  await lead("Hand Built Nexus", { stage: "preview_built", previewUrl: "https://by-hand.vercel.app", previewBuiltAt: new Date() });
  const rebuilt = await lead("Rebuilt by Hand", { stage: "preview_built", previewUrl: "https://second-by-hand.vercel.app", previewBuiltAt: new Date() });
  await database.insert(previewJobs).values({ businessId: rebuilt.id, status: "done", requestedBy: "auto-queue", previewUrl: "https://runner-first.vercel.app", finishedAt: new Date() });
  assert.deepEqual(await listed(), [], "the runner once built the second, but the preview it has now was deployed by hand");
});
