/**
 * The nav's Messages badge counts unread received mail without loading the threads.
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

const { threadSummaries, unreadMessageCount } = await import("./threads");

before(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });
});

after(async () => {
  await pglite.close();
});

beforeEach(async () => {
  await database.delete(schema.messages);
  await database.delete(schema.businesses);
});

describe("unread message count", () => {
  it("equals the unread total across threads, ignoring read and sent mail", async () => {
    for (const name of ["a", "b"]) {
      const [business] = await database.insert(schema.businesses).values({ slug: name, linkCode: name, businessName: name }).returning();
      const mail = { businessId: business.id, kind: "reply" as const, fromAddress: "x@example.com", toAddress: "y@example.com", body: "hi" };
      await database.insert(schema.messages).values([
        { ...mail, direction: "in" },
        { ...mail, direction: "in" },
        { ...mail, direction: "in", readAt: new Date() },
        { ...mail, direction: "out" },
      ]);
    }
    const fromThreads = (await threadSummaries()).reduce((total, thread) => total + thread.unread, 0);
    assert.equal(await unreadMessageCount(), 4);
    assert.equal(await unreadMessageCount(), fromThreads);
  });
});
