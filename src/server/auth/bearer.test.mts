/**
 * The bearer check lets a request through only when it carries exactly the expected secret.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("server-only", { namedExports: {} });

const { hasBearer } = await import("./bearer");

const requestWith = (authorization?: string) => new Request("https://defect.tech/api/x", authorization === undefined ? {} : { headers: { authorization } });

test("the exact secret passes", () => {
  assert.equal(hasBearer(requestWith("Bearer s3cret"), "s3cret"), true);
});

test("a missing header fails", () => {
  assert.equal(hasBearer(requestWith(), "s3cret"), false);
});

test("a wrong secret fails, also when it has the same length", () => {
  assert.equal(hasBearer(requestWith("Bearer s3creX"), "s3cret"), false);
  assert.equal(hasBearer(requestWith("Bearer s3cret-and-more"), "s3cret"), false);
  assert.equal(hasBearer(requestWith("Bearer s3cre"), "s3cret"), false);
});

test("the secret without the Bearer word, or with another scheme, fails", () => {
  assert.equal(hasBearer(requestWith("s3cret"), "s3cret"), false);
  assert.equal(hasBearer(requestWith("Basic s3cret"), "s3cret"), false);
});

test("a secret that is not set never matches, not even an empty header value", () => {
  assert.equal(hasBearer(requestWith("Bearer "), ""), false);
  assert.equal(hasBearer(requestWith("Bearer"), ""), false);
  assert.equal(hasBearer(requestWith(""), ""), false);
  assert.equal(hasBearer(requestWith(), ""), false);
});
