/**
 * The call to GitHub for a bot's instructions gives up after a set time, and the bot hears a clear 502 instead of a hang.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { startEmptyTestDatabase } from "../emptyTestDatabase";

mock.module("server-only", { namedExports: {} });

const closeDatabase = await startEmptyTestDatabase();
const realFetch = globalThis.fetch;
const realToken = process.env.GITHUB_READ_TOKEN;
process.env.GITHUB_READ_TOKEN = "test-token";

after(async () => {
  globalThis.fetch = realFetch;
  if (realToken === undefined) delete process.env.GITHUB_READ_TOKEN;
  else process.env.GITHUB_READ_TOKEN = realToken;
  await closeDatabase();
});

test("the call to GitHub carries a time limit, and a timeout becomes a 502", async () => {
  let signal: AbortSignal | null | undefined;
  globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
    signal = init?.signal;
    throw new DOMException("The operation timed out.", "TimeoutError");
  }) as typeof fetch;
  const { botInstructions } = await import("./instructions");
  await assert.rejects(botInstructions("outreach"), (error: { status?: number }) => error.status === 502);
  assert.ok(signal instanceof AbortSignal);
});
