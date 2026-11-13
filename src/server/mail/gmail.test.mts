/**
 * Reading and sending through the Gmail API, with fetch stood in for.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

mock.module("server-only", {});
mock.module("next/headers", { namedExports: { cookies: async () => ({}) } });
mock.module("../auth/google", {
  namedExports: {
    googleClient: () => ({
      refreshAccessToken: async () => ({ accessToken: () => "token", accessTokenExpiresAt: () => new Date(Date.now() + 3_600_000) }),
    }),
  },
});
mock.module("../seal", { namedExports: { unseal: (value: string) => value } });

const { mailSince, sendEmail, SendOutcomeUnknown } = await import("./gmail");

const mailbox = { id: "mailbox-1", email: "cold@example.com", sealedRefreshToken: "sealed" } as never;
const realFetch = globalThis.fetch;

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fullMessage(id: string, minutesAgo: number) {
  return {
    id,
    threadId: `thread-${id}`,
    internalDate: String(Date.UTC(2026, 0, 1, 12, 0) - minutesAgo * 60_000),
    payload: { headers: [{ name: "From", value: "owner@shop.example" }, { name: "Message-ID", value: `<${id}@shop.example>` }] },
  };
}

function stubGmail(handler: (url: URL, init: RequestInit) => Response | Promise<Response>) {
  calls = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    return handler(new URL(String(input)), init);
  }) as typeof fetch;
}

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("mailSince", () => {
  it("follows every page of the list before reading messages", async () => {
    stubGmail((url) => {
      if (url.pathname.endsWith("/messages") && !url.searchParams.get("pageToken")) {
        return json({ messages: [{ id: "c" }, { id: "b" }], nextPageToken: "page-2" });
      }
      if (url.pathname.endsWith("/messages")) return json({ messages: [{ id: "a" }] });
      const id = url.pathname.split("/").pop() as string;
      return json(fullMessage(id, { a: 30, b: 20, c: 10 }[id] ?? 0));
    });
    const { emails, resumeFrom } = await mailSince(mailbox, "inbox", new Date(0));
    assert.deepEqual(emails.map((email) => email.gmailId), ["a", "b", "c"]);
    assert.equal(resumeFrom, null);
  });

  it("returns the oldest messages first and says where to resume when a run cannot read them all", async () => {
    const ids = Array.from({ length: 250 }, (_, index) => `m${index}`);
    stubGmail((url) => {
      if (url.pathname.endsWith("/messages")) {
        const page = Number(url.searchParams.get("pageToken") ?? 0);
        const slice = ids.slice(page * 100, page * 100 + 100).map((id) => ({ id }));
        return json({ messages: slice, nextPageToken: page < 2 ? String(page + 1) : undefined });
      }
      const id = url.pathname.split("/").pop() as string;
      return json(fullMessage(id, Number(id.slice(1))));
    });
    const { emails, resumeFrom } = await mailSince(mailbox, "inbox", new Date(0));
    assert.equal(emails.length, 200);
    assert.equal(emails[0].gmailId, "m249");
    assert.ok(resumeFrom && resumeFrom.getTime() <= emails[emails.length - 1].at.getTime());
    assert.ok(resumeFrom.getTime() > emails[0].at.getTime());
  });

  it("gives every read a timeout", async () => {
    stubGmail(() => json({ messages: [] }));
    await mailSince(mailbox, "inbox", new Date(0));
    assert.ok(calls.every((call) => call.init.signal));
  });

  it("tries a rate-limited read again", async () => {
    let attempts = 0;
    stubGmail(() => (++attempts === 1 ? json({}, 429) : json({ messages: [] })));
    const { emails } = await mailSince(mailbox, "inbox", new Date(0));
    assert.deepEqual(emails, []);
    assert.equal(attempts, 2);
  });
});

const email = { from: { name: "Boris", email: "cold@example.com" }, to: "owner@shop.example", cc: [], bcc: [], subject: "Hi", body: "Hello", threadId: null, inReplyTo: null };

describe("sendEmail", () => {
  it("still reports the email as sent when the follow-up read of its headers fails", async () => {
    stubGmail((url, init) => (init.method === "POST" ? json({ id: "sent-1", threadId: "thread-1" }) : json({}, 503)));
    const sent = await sendEmail(mailbox, email);
    assert.deepEqual(sent, { gmailId: "sent-1", threadId: "thread-1", headerMessageId: "" });
  });

  it("says the outcome is unknown when Gmail does not answer the send", async () => {
    stubGmail(() => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    await assert.rejects(sendEmail(mailbox, email), SendOutcomeUnknown);
  });

  it("does not try the send again", async () => {
    stubGmail(() => json({}, 429));
    await assert.rejects(sendEmail(mailbox, email), /answered 429/);
    assert.equal(calls.length, 1);
  });
});
