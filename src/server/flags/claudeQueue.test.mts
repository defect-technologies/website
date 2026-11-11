/**
 * A flag claimed by the flag worker that never reports goes back to the queue once the claim is older than a session can last.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema";

mock.module("server-only", {});
process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";

const pglite = new PGlite();
const database = drizzle(pglite, { schema });
(globalThis as { defectDb?: Promise<unknown> }).defectDb = Promise.resolve(database);

const { claimClaudeFlag, waitingClaudeFlags } = await import("./claudeQueue");

const MINUTE = 60_000;
const claimedNote = (minutesAgo: number) => `Claude started on this ${new Date(Date.now() - minutesAgo * MINUTE).toISOString()}.`;

const insertClaudeFlag = async (reviewer: string, note: string) => {
  const [flag] = await database
    .insert(schema.flags)
    .values({ bot: "runner", priority: "review", fixer: "claude", headline: "Fix it", reviewer, note })
    .returning();
  return flag.id;
};

before(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });
});

after(async () => {
  await pglite.close();
});

describe("a flag claimed by Claude", () => {
  it("stays claimed while a session could still be running", async () => {
    const id = await insertClaudeFlag("claude", claimedNote(10));
    assert.ok(!(await waitingClaudeFlags()).some((flag) => flag.id === id));
    assert.equal(await claimClaudeFlag(id), false);
  });

  it("is listed and can be claimed again once the claim is older than a session can last", async () => {
    const id = await insertClaudeFlag("claude", claimedNote(90));
    assert.ok((await waitingClaudeFlags()).some((flag) => flag.id === id));
    assert.equal(await claimClaudeFlag(id), true);
    const [claimed] = await database.select().from(schema.flags).where(eq(schema.flags.id, id));
    assert.ok(Date.now() - new Date(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/.exec(claimed.note)![0]).getTime() < MINUTE);
    assert.equal(await claimClaudeFlag(id), false);
  });
});
