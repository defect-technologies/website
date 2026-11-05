import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("server-only", { namedExports: {} });

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

  // The in-process Postgres stays open otherwise, and the test run never ends.
  await (database as unknown as { $client?: { close?: () => Promise<void> } }).$client?.close?.();
});
