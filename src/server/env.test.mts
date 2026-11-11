/**
 * SITE_URL decides every link we email and every OAuth redirect, so outside development a missing value must
 * fail loudly instead of becoming a localhost link.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

mock.module("server-only", { namedExports: {} });

const { env } = await import("./env");
const variables = process.env as Record<string, string | undefined>;
const saved = { NODE_ENV: variables.NODE_ENV, SITE_URL: variables.SITE_URL, VERCEL_URL: variables.VERCEL_URL, VERCEL_ENV: variables.VERCEL_ENV };

afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete variables[name];
    else variables[name] = value;
  }
});

test("development falls back to the local address", () => {
  variables.NODE_ENV = "development";
  delete variables.SITE_URL;
  assert.equal(env.siteUrl(), "http://localhost:3217");
});

test("production without SITE_URL throws where the value is used", () => {
  variables.NODE_ENV = "production";
  delete variables.SITE_URL;
  delete variables.VERCEL_URL;
  delete variables.VERCEL_ENV;
  assert.throws(() => env.siteUrl(), /SITE_URL is not set/);
});

test("a Vercel preview without SITE_URL uses its own address", () => {
  variables.NODE_ENV = "production";
  delete variables.SITE_URL;
  variables.VERCEL_ENV = "preview";
  variables.VERCEL_URL = "defect-abc.vercel.app";
  assert.equal(env.siteUrl(), "https://defect-abc.vercel.app");
});

test("a set SITE_URL always wins", () => {
  variables.NODE_ENV = "production";
  variables.SITE_URL = "https://defect.tech";
  assert.equal(env.siteUrl(), "https://defect.tech");
});
