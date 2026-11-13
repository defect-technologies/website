/**
 * A stalled pooler must not hold the single connection of an instance until the platform kills the request.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("server-only", { namedExports: {} });

const poolOptions: Record<string, unknown>[] = [];
class FakePool {
  constructor(options: Record<string, unknown>) {
    poolOptions.push(options);
  }
  on() {}
}
mock.module("pg", { namedExports: { Pool: FakePool }, defaultExport: { Pool: FakePool } });
mock.module("drizzle-orm/node-postgres", { namedExports: { drizzle: () => ({}) } });

test("the pool gives up on a stalled connection and a stalled query", async () => {
  process.env.DATABASE_URL = "postgres://user:pass@db.example.com:5432/app";
  const { db } = await import("./client");
  await db();
  const [options] = poolOptions;
  assert.equal(options.max, 1);
  for (const name of ["connectionTimeoutMillis", "idleTimeoutMillis", "query_timeout", "statement_timeout"]) {
    assert.equal(typeof options[name], "number", name);
  }
  assert.ok((options.query_timeout as number) >= 30_000, "long enough for the sync cron's slowest query");
});
