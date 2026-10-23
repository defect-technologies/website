/**
 * Whether a deployed preview sells to the lead it's tagged for.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

mock.module("server-only", {});
const { checkoutProblem } = await import("./previewChecks");

const WELCOME = "https://defect.tech/welcome/esr8ejz9";

describe("checkoutProblem", () => {
  it("passes a page whose button goes to the lead's checkout", () => {
    assert.equal(checkoutProblem(`<a href="${WELCOME}">Make it live</a>`, WELCOME), null);
  });

  it("catches a preview deployed without CHECKOUT_URL", () => {
    assert.match(checkoutProblem(`<a class="pill">Make it live</a>`, WELCOME) ?? "", /no link/);
  });

  it("catches a preview selling to another lead", () => {
    assert.match(checkoutProblem(`<a href="https://defect.tech/welcome/zzzz1111">Make it live</a>`, WELCOME) ?? "", /another lead/);
  });
});
