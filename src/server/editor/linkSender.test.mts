/**
 * The sign-in email call to Resend gives up after a set time instead of hanging the sign-in page.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { after, test, mock } from "node:test";

mock.module("server-only", {});
mock.module("../env", {
  namedExports: { isDevelopment: false, env: { signInEmail: () => ({ apiKey: "test-key", from: "Test <test@example.com>" }) } },
});

const realFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = realFetch;
});

const { sendPlainEmail } = await import("./linkSender");

test("the call to Resend carries a time limit", async () => {
  let signal: AbortSignal | null | undefined;
  globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
    signal = init?.signal;
    return new Response("{}");
  }) as typeof fetch;
  await sendPlainEmail({ to: "a@example.com", subject: "Hi", text: "Hi" });
  assert.ok(signal instanceof AbortSignal);
});
