/**
 * The page a portal sign-in returns to must stay inside the portal.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("server-only", { namedExports: {} });

const { safeNext } = await import("./accounts");

test("keeps a portal path", () => {
  assert.equal(safeNext("/portal/edit/acme"), "/portal/edit/acme");
});

test("rejects addresses that leave the portal", () => {
  for (const next of ["//evil.com", "https://evil.com", "/portal/../admin", "/admin", "", null, undefined]) {
    assert.ok(safeNext(next).startsWith("/portal"), String(next));
    assert.ok(!safeNext(next).includes(".."), String(next));
  }
});
