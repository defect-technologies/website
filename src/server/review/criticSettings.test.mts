/**
 * The minutes the admin accepts for critics are the minutes the build engine really uses (2 to 90),
 * and a value saved under the old 1 to 120 range is kept inside it instead of switching critics off.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema";

mock.module("server-only", {});
process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";

const pglite = new PGlite();
const database = drizzle(pglite, { schema });
(globalThis as { defectDb?: Promise<unknown> }).defectDb = Promise.resolve(database);

const { MAX_CRITIC_MINUTES, MIN_CRITIC_MINUTES } = await import("@/lib/critics");
const { CriticSettingsInput, criticSettings } = await import("./criticSettings");

const withMinutes = (minutes: number) => ({ enabled: true, minutes, apply: [], maxNotes: 24, secondBuilder: false });

before(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });
});

after(async () => {
  await pglite.close();
});

describe("critic minutes", () => {
  it("use the range of the build engine", () => {
    assert.equal(MIN_CRITIC_MINUTES, 2);
    assert.equal(MAX_CRITIC_MINUTES, 90);
  });

  it("are refused outside that range", () => {
    assert.ok(CriticSettingsInput.safeParse(withMinutes(2)).success);
    assert.ok(CriticSettingsInput.safeParse(withMinutes(90)).success);
    assert.ok(!CriticSettingsInput.safeParse(withMinutes(1)).success);
    assert.ok(!CriticSettingsInput.safeParse(withMinutes(91)).success);
  });

  it("saved above the range are read as the top of the range, with critics still on", async () => {
    await database.insert(schema.settings).values({ key: "critics", value: withMinutes(120), updatedBy: "test" });
    assert.deepEqual(await criticSettings(), withMinutes(90));
  });
});
