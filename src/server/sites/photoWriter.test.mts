/**
 * The photo writer's daily cap counts every request that reaches Claude, parallel ones and failed ones included.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema";

mock.module("server-only", {});
process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const claudeCalls: Record<string, unknown>[] = [];
let claudeAnswer: () => Promise<unknown> = async () => ({});
const realFetch = globalThis.fetch;
globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
  claudeCalls.push(JSON.parse(String(init?.body)));
  try {
    return Response.json(await claudeAnswer());
  } catch {
    return new Response("{}", { status: 400 });
  }
}) as typeof fetch;

const pglite = new PGlite();
const database = drizzle(pglite, { schema });
(globalThis as { defectDb?: Promise<unknown> }).defectDb = Promise.resolve(database);

const { describePhoto } = await import("./photoWriter");

const SESSION = { site: "sample", email: "owner@example.com" };
const REQUEST = { subject: "photo" as const, image: "https://sample.example/a.jpg", name: "", business: "", textLimit: 0, altLimit: 100 };
const goodAnswer = async () => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "test",
  stop_reason: "end_turn",
  content: [{ type: "text", text: JSON.stringify({ text: "", alt: "A loaf of bread." }) }],
  usage: { input_tokens: 1, output_tokens: 1 },
});
const failure = async () => {
  throw new Error("Claude is down");
};
const wroteRows = () => database.select().from(schema.activity);

before(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });
  await database.insert(schema.clientSites).values({ slug: "sample", ownerEmail: "owner@example.com", url: "https://sample.example", createdBy: "test" });
});

beforeEach(async () => {
  claudeCalls.length = 0;
  claudeAnswer = goodAnswer;
  await database.delete(schema.activity);
});

after(async () => {
  globalThis.fetch = realFetch;
  await pglite.close();
});

const fillTheDay = (rows: number) =>
  database.insert(schema.activity).values(Array.from({ length: rows }, () => ({ actor: "site:sample", action: "wrote from a photo" })));

describe("the photo writer daily cap", () => {
  it("lets only the requests under the cap reach Claude when many arrive at once", async () => {
    await fillTheDay(97);
    const replies = await Promise.all(Array.from({ length: 10 }, () => describePhoto(SESSION, REQUEST)));
    assert.equal(replies.filter((reply) => reply.status === 200).length, 3);
    assert.equal(replies.filter((reply) => reply.status === 429).length, 7);
    assert.equal(claudeCalls.length, 3);
    assert.equal((await wroteRows()).length, 100);
  });

  it("gives the slot back when Claude fails, so a failure does not use up the day", async () => {
    claudeAnswer = failure;
    const reply = await describePhoto(SESSION, REQUEST);
    assert.equal(reply.status, 502);
    assert.equal((await wroteRows()).length, 0);
  });

  it("asks Claude for a short answer", async () => {
    await describePhoto(SESSION, REQUEST);
    assert.ok(Number(claudeCalls[0].max_tokens) <= 1000);
  });
});
