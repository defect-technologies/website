/**
 * The review page's kit-only rebuild backfill: it works from the queue it is handed and looks up every build start
 * time in one query.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema";

mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });
mock.module("server-only", {});

const pglite = new PGlite();
const database = drizzle(pglite, { schema });
(globalThis as { defectDb?: Promise<unknown> }).defectDb = Promise.resolve(database);

const { queuePointingUpdates } = await import("./pointingUpdates");
const { reviewQueue } = await import("./queue");
const { POINTING_NOTE } = await import("@/lib/review");

const BEFORE_BRIDGE = new Date("2026-11-01T00:00:00Z");
const AFTER_BRIDGE = new Date("2026-11-11T00:00:00Z");

async function previewBuiltAt(name: string, startedAt: Date | null) {
  const previewUrl = `https://${name}.preview.example`;
  const [business] = await database
    .insert(schema.businesses)
    .values({ slug: name, linkCode: name, businessName: name, previewUrl, stage: "preview_built", previewBuiltAt: startedAt })
    .returning();
  await database.insert(schema.previewJobs).values({ businessId: business.id, requestedBy: "test", status: "done", previewUrl, startedAt, finishedAt: startedAt });
  return business;
}

before(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });
});

after(async () => {
  await pglite.close();
});

beforeEach(async () => {
  await database.delete(schema.activity);
  await database.delete(schema.previewJobs);
  await database.delete(schema.businesses);
});

describe("pointing updates", () => {
  it("queues a rebuild only for previews built before the review bridge", async () => {
    const old = await previewBuiltAt("old-build", BEFORE_BRIDGE);
    await previewBuiltAt("new-build", AFTER_BRIDGE);
    await previewBuiltAt("by-hand", null);
    assert.equal(await queuePointingUpdates(await reviewQueue()), 1);
    const queued = await database.select().from(schema.previewJobs);
    assert.deepEqual(queued.filter((job) => job.status === "queued").map((job) => [job.businessId, job.note]), [[old.id, POINTING_NOTE]]);
  });

  it("works from the queue it is given and reads every build start time in one query", async () => {
    for (const name of ["a", "b", "c"]) await previewBuiltAt(name, AFTER_BRIDGE);
    const queue = await reviewQueue();
    const select = mock.method(database, "select");
    await queuePointingUpdates(queue);
    assert.equal(select.mock.callCount(), 1);
  });
});
