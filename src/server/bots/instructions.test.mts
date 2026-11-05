/**
 * Every bot shares one instructions address and tells them apart only by its key, so each must get its own
 * spec, and no cache between the bot and the admin may keep one bot's answer for another.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { after, mock, test } from "node:test";

mock.module("server-only", { namedExports: {} });

const realFetch = globalThis.fetch;
const realToken = process.env.GITHUB_READ_TOKEN;
process.env.GITHUB_READ_TOKEN = "test-token";
globalThis.fetch = (async (url: string | URL) => {
  const name = /bots\/([\w-]+)\.md/.exec(String(url))?.[1];
  return new Response(`**Description:**\n\n\`\`\`\nYou are ${name}.\n\`\`\`\n`);
}) as typeof fetch;

after(async () => {
  globalThis.fetch = realFetch;
  if (realToken === undefined) delete process.env.GITHUB_READ_TOKEN;
  else process.env.GITHUB_READ_TOKEN = realToken;
  const { db } = await import("../db/client");
  // The in-process Postgres stays open otherwise, and the test run never ends.
  await ((await db()) as unknown as { $client?: { close?: () => Promise<void> } }).$client?.close?.();
});

const call = (GET: (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>, key?: string) =>
  GET(new Request("https://defect.tech/api/bot/instructions", { headers: key ? { Authorization: `Bearer ${key}` } : {} }), { params: Promise.resolve({}) });

test("each key gets its own bot's instructions, even when bots ask at the same moment", async () => {
  const { createBotKey } = await import("./keys");
  const { GET } = await import("../../app/api/bot/instructions/route");
  const onboarding = await createBotKey("onboarding", "test", "test");
  const overseer = await createBotKey("overseer", "test", "test");

  const replies = await Promise.all([overseer, onboarding, overseer, onboarding].map((made) => call(GET, made.key)));
  const bodies = await Promise.all(replies.map((reply) => reply.json()));

  assert.deepEqual(
    bodies.map((body) => [body.bot, body.instructions, body.source.split("/").pop()]),
    [
      ["overseer", "You are overseer.", "overseer.md"],
      ["onboarding", "You are onboarding.", "onboarding.md"],
      ["overseer", "You are overseer.", "overseer.md"],
      ["onboarding", "You are onboarding.", "onboarding.md"],
    ],
  );
});

test("no answer from the bot API may be kept by a cache or shared between keys", async () => {
  const { createBotKey } = await import("./keys");
  const { GET } = await import("../../app/api/bot/instructions/route");
  const onboarding = await createBotKey("onboarding", "test", "test");

  for (const reply of [await call(GET, onboarding.key), await call(GET)]) {
    assert.equal(reply.headers.get("cache-control"), "private, no-store");
    assert.equal(reply.headers.get("vary"), "Authorization");
  }
});
