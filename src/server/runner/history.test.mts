import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { startEmptyTestDatabase } from "../emptyTestDatabase";

mock.module("server-only", { namedExports: {} });

const closeDatabase = await startEmptyTestDatabase();

test("the history reaches every finished build a page at a time, newest first", async () => {
  const { db } = await import("../db/client");
  const { businesses, previewJobs } = await import("../db/schema");
  const { BUILDS_PER_PAGE, buildHistory } = await import("./history");
  const database = await db();
  const stamp = Date.now();
  const [lead] = await database.insert(businesses).values({ businessName: "History test", slug: `history-${stamp}`, linkCode: `history-${stamp}`, stage: "new" } as never).returning({ id: businesses.id });
  // Dated in the future so these are the newest rows, whatever else the local database holds.
  const finishedAt = (index: number) => new Date(Date.UTC(2999, 0, 1) - index * 60_000);
  const count = BUILDS_PER_PAGE + 1;
  const rows = Array.from({ length: count }, (_, index) => ({ businessId: lead.id, status: "done" as const, requestedBy: "test", step: `build-${index}`, finishedAt: finishedAt(index) }));
  await database.insert(previewJobs).values(rows);

  const first = await buildHistory(1);
  assert.deepEqual(first.jobs.map((job) => job.step), rows.slice(0, BUILDS_PER_PAGE).map((row) => row.step));
  assert.ok(first.pages >= 2);

  const second = await buildHistory(2);
  assert.equal(second.jobs[0].step, `build-${count - 1}`);
  assert.equal(second.page, 2);

  const past = await buildHistory(99_999);
  assert.equal(past.page, past.pages);
  assert.ok(past.jobs.length > 0);
});

test("hiding an outcome takes it out of the rows and the page count, and the query agrees with buildOutcome", async () => {
  const { db } = await import("../db/client");
  const { businesses, previewJobs } = await import("../db/schema");
  const { buildHistory } = await import("./history");
  const { buildOutcome, SKIPPED_STEP } = await import("../../lib/previewJobs");
  const database = await db();
  const stamp = Date.now();
  const [lead] = await database.insert(businesses).values({ businessName: "Outcome test", slug: `outcome-${stamp}`, linkCode: `outcome-${stamp}`, stage: "new" } as never).returning({ id: businesses.id });
  const before = (await buildHistory(1)).counts;
  const finishedAt = new Date(Date.UTC(3000, 0, 1));
  const base = { businessId: lead.id, requestedBy: "test", finishedAt };
  await database.insert(previewJobs).values([
    { ...base, status: "done" },
    { ...base, status: "done", kind: "launch" },
    { ...base, status: "failed", step: "Building" },
    { ...base, status: "failed", step: SKIPPED_STEP },
    { ...base, status: "waiting_for_usage" },
  ]);

  const everything = await buildHistory(1);
  for (const outcome of ["built", "launched", "failed", "skipped", "paused"] as const) assert.equal(everything.counts[outcome], before[outcome] + 1, outcome);
  assert.deepEqual(everything.jobs.slice(0, 5).map(buildOutcome).sort(), ["built", "failed", "launched", "paused", "skipped"]);
  const total = Object.values(everything.counts).reduce((sum, value) => sum + value, 0);
  assert.equal(everything.shown, total);

  const hidden = await buildHistory(1, ["failed", "skipped"]);
  assert.equal(hidden.shown, total - everything.counts.failed - everything.counts.skipped);
  assert.ok(hidden.jobs.every((job) => !["failed", "skipped"].includes(buildOutcome(job))));
  assert.deepEqual(hidden.counts, everything.counts);

  assert.equal((await buildHistory(1, ["built", "launched", "failed", "skipped", "paused"])).jobs.length, 0);
});

after(async () => {
  await closeDatabase();
});
