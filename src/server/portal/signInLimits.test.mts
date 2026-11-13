/**
 * One caller cannot use up the sign-in allowance of an owner who asks from another address, and a request
 * dropped by a cap is never reported as sent.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import { startEmptyTestDatabase } from "../emptyTestDatabase";
import { portalFailedSignIns, portalLinks } from "../db/schema";

process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";

mock.module("server-only", { namedExports: {} });
mock.module("next/headers", { namedExports: { cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) } });

const OWNER = "owner@limits.example";
const CALLER_A = "caller-a";
const CALLER_B = "caller-b";

const closeDatabase = await startEmptyTestDatabase();
const { db } = await import("../db/client");
const { addClientSite } = await import("../sites/clientSites");
const { emailPortalLink, signInWithPassword, setPassword } = await import("./accounts");
const { callerKeyFrom } = await import("./callerKey");

const quietly = async <T,>(run: () => Promise<T>) => {
  const info = mock.method(console, "info", () => {});
  try {
    return await run();
  } finally {
    info.mock.restore();
  }
};

before(async () => {
  const added = await addClientSite({ slug: "limits", ownerEmail: OWNER, url: "https://limits.example", businessId: null, createdBy: "test" });
  assert.ok(added);
  await setPassword(OWNER, "", "correct horse battery");
});

beforeEach(async () => {
  const database = await db();
  await database.delete(portalLinks);
  await database.delete(portalFailedSignIns);
});

after(async () => {
  await closeDatabase();
});

describe("sign-in link requests", () => {
  it("lets the owner ask from another address after one caller used its share", async () => {
    await quietly(async () => {
      for (let attempt = 0; attempt < 3; attempt++) assert.equal(await emailPortalLink(OWNER, "/portal", CALLER_A), "sent");
      assert.equal(await emailPortalLink(OWNER, "/portal", CALLER_A), "limited");
      assert.equal(await emailPortalLink(OWNER, "/portal", CALLER_B), "sent");
    });
    assert.equal((await (await db()).select().from(portalLinks)).length, 4);
  });

  it("still caps the total links a site's owner can get", async () => {
    await quietly(async () => {
      let sent = 0;
      for (let caller = 0; caller < 20; caller++) if ((await emailPortalLink(OWNER, "/portal", `caller-${caller}`)) === "sent") sent += 1;
      assert.equal(sent, 10);
      assert.equal(await emailPortalLink(OWNER, "/portal", "caller-new"), "limited");
    });
  });

  it("keeps today's limit when no caller is known", async () => {
    await quietly(async () => {
      for (let attempt = 0; attempt < 3; attempt++) assert.equal(await emailPortalLink(OWNER, "/portal"), "sent");
    });
  });
});

describe("password sign-in", () => {
  it("locks out only the caller who guessed wrong", async () => {
    for (let attempt = 0; attempt < 5; attempt++) assert.equal(await signInWithPassword(OWNER, "wrong password", CALLER_A), "wrong");
    assert.equal(await signInWithPassword(OWNER, "correct horse battery", CALLER_A), "locked");
    assert.equal(await signInWithPassword(OWNER, "correct horse battery", CALLER_B), "signed-in");
  });

  it("still locks everyone out after many wrong guesses from many callers", async () => {
    for (let caller = 0; caller < 20; caller++) await signInWithPassword(OWNER, "wrong password", `caller-${caller}`);
    assert.equal(await signInWithPassword(OWNER, "correct horse battery", "caller-fresh"), "locked");
  });
});

describe("caller key", () => {
  it("is a keyed hash of the first forwarded address and never the address", () => {
    const key = callerKeyFrom("203.0.113.7, 10.0.0.1");
    assert.ok(key);
    assert.ok(!key.includes("203.0.113.7"));
    assert.equal(key, callerKeyFrom("203.0.113.7"));
    assert.notEqual(key, callerKeyFrom("203.0.113.8"));
  });

  it("is absent when no address was forwarded", () => {
    assert.equal(callerKeyFrom(null), undefined);
    assert.equal(callerKeyFrom(" "), undefined);
  });
});
