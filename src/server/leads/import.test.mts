/**
 * New slugs must pass the site kit's slug rule, and a lead that already has a slug keeps it.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("server-only", {});
process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";

const { uniqueSlug } = await import("./import");

const KIT_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

test("a name cut at a word break does not leave a dash at the end of the slug", () => {
  const slug = uniqueSlug(`${"a".repeat(47)} bcd`, new Set());
  assert.match(slug, KIT_SLUG);
  assert.equal(slug, "a".repeat(47));
});

test("a taken slug gets a number that still passes the kit rule", () => {
  const name = `${"a".repeat(47)} bcd`;
  const taken = new Set<string>();
  uniqueSlug(name, taken);
  assert.match(uniqueSlug(name, taken), KIT_SLUG);
});

test("ordinary names keep the slug they always had", () => {
  assert.equal(uniqueSlug("Joe's Plumbing & Heating", new Set()), "joe-s-plumbing-heating");
  assert.equal(uniqueSlug("!!!", new Set()), "business");
});
