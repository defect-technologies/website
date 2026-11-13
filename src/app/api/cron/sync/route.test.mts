/**
 * The sync cron runs both parts every time and answers 500 when either part failed, so Vercel's cron view shows the failure.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";

mock.module("server-only", {});
process.env.CRON_SECRET = "test-cron-secret";

let mail: { mailboxes: number; newMessages: number; errors: string[] };
let payments: { state: string };
let mailRuns = 0;
let paymentRuns = 0;
mock.module("@/server/mail/sync", {
  namedExports: {
    syncMail: async () => {
      mailRuns += 1;
      return mail;
    },
  },
});
mock.module("@/server/integrations/stripe", {
  namedExports: {
    syncPayments: async () => {
      paymentRuns += 1;
      return payments;
    },
  },
});

const { GET } = await import("./route");
const call = () => GET(new Request("https://defect.tech/api/cron/sync", { headers: { Authorization: "Bearer test-cron-secret" } }));

beforeEach(() => {
  mail = { mailboxes: 1, newMessages: 0, errors: [] };
  payments = { state: "ok" };
  mailRuns = 0;
  paymentRuns = 0;
});

describe("the sync cron status", () => {
  it("is 200 when both parts worked", async () => {
    assert.equal((await call()).status, 200);
  });

  it("is 500 with the full body when a payments sync fails, and the mail part still ran", async () => {
    payments = { state: "error" };
    const response = await call();
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { mail, payments });
    assert.equal(mailRuns, 1);
    assert.equal(paymentRuns, 1);
  });

  it("is 500 when a mailbox fails", async () => {
    mail = { mailboxes: 1, newMessages: 0, errors: ["a@example.com: refused"] };
    assert.equal((await call()).status, 500);
  });

  it("stays 200 when payments are not configured", async () => {
    payments = { state: "not_configured" };
    assert.equal((await call()).status, 200);
  });
});
