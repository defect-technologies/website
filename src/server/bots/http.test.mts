/**
 * The audit log of bot calls must never change what a bot is told: an action that already happened must not
 * come back as a 500, or the bot repeats it.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("server-only", { namedExports: {} });
mock.module("../db/client", {
  namedExports: {
    db: async () => ({
      insert: () => ({
        values: async () => {
          throw new Error("log insert failed");
        },
      }),
    }),
  },
});
const bot = { id: "key-1", bot: "scout" };
mock.module("./keys", { namedExports: { keyFromRequest: async (request: Request) => (request.headers.get("authorization") ? bot : null) } });

const { botRoute } = await import("./http");
const context = { params: Promise.resolve({}) };

test("a failed log insert leaves the answer of a finished action unchanged", async () => {
  const route = botRoute(async () => ({ sent: true }));
  const response = await route(new Request("https://defect.tech/api/bot/x", { method: "POST", headers: { authorization: "Bearer k" } }), context);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sent: true });
});

test("a failed log insert still answers 401 for a wrong key", async () => {
  const route = botRoute(async () => ({}));
  const response = await route(new Request("https://defect.tech/api/bot/x"), context);
  assert.equal(response.status, 401);
});
