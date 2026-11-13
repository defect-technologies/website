/**
 * How a read from an outside service gives up or tries again.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { after, afterEach, describe, it, mock } from "node:test";

mock.module("server-only", {});

const { getJson } = await import("./result");

const realFetch = globalThis.fetch;
let answers: (Response | Error)[] = [];
let requests = 0;

globalThis.fetch = (async () => {
  requests += 1;
  const answer = answers.shift() ?? new Response("{}", { status: 200 });
  if (answer instanceof Error) throw answer;
  return answer;
}) as typeof fetch;

after(() => {
  globalThis.fetch = realFetch;
});

afterEach(() => {
  answers = [];
  requests = 0;
});

const status = (code: number) => new Response("busy", { status: code });
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("getJson", () => {
  it("asks again after a 429 and returns the answer that follows", async () => {
    answers = [status(429), json({ ok: true })];
    assert.deepEqual(await getJson("https://api.example.com/x", {}), { ok: true });
    assert.equal(requests, 2);
  });

  it("gives up after two more tries on a 503", async () => {
    answers = [status(503), status(503), status(503), json({ ok: true })];
    await assert.rejects(getJson("https://api.example.com/x", {}), /answered 503/);
    assert.equal(requests, 3);
  });

  it("does not ask again after a 404", async () => {
    answers = [status(404), json({ ok: true })];
    await assert.rejects(getJson("https://api.example.com/x", {}), /answered 404/);
    assert.equal(requests, 1);
  });

  it("does not ask again after the call timed out", async () => {
    answers = [new DOMException("timed out", "TimeoutError"), json({ ok: true })];
    await assert.rejects(getJson("https://api.example.com/x", {}));
    assert.equal(requests, 1);
  });
});
