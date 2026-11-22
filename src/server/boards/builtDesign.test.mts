/**
 * Which chosen design a built preview came from.
 *
 *   npm test
 *
 * Runs against an in-memory Postgres (PGlite) migrated from drizzle/.
 */
import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import type { BoardLetter, BoardOption } from "@/lib/boards";
import { startEmptyTestDatabase } from "../emptyTestDatabase";

mock.module("server-only", { namedExports: {} });
process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";

const closeDatabase = await startEmptyTestDatabase();
after(closeDatabase);
const { db } = await import("../db/client");
const { businesses, previewJobs } = await import("../db/schema");
const { eq } = await import("drizzle-orm");
const store = await import("./store");
const { builtDesignFor } = await import("./builtDesign");
const database = await db();

let made = 0;
async function lead() {
  made += 1;
  const [business] = await database.insert(businesses).values({ businessName: `Built ${made}`, slug: `built-${made}`, linkCode: `built-${made}`, website: `https://built-${made}.example` } as never).returning();
  return business;
}

async function job(businessId: string, status: "running" | "done" | "failed") {
  const [row] = await database.insert(previewJobs).values({ businessId, requestedBy: "test", status }).returning();
  return row;
}

function option(letter: BoardLetter, name: string): BoardOption {
  const picture = (view: string) => `https://store.example/boards/${letter}-${view}.jpg`;
  return {
    letter,
    boldness: 2,
    name,
    idea: "An idea.",
    palette: { background: "#ffffff", accent: "#b23c17" },
    fonts: { heading: "Zilla Slab", body: "DM Sans" },
    layout: "split-hero",
    controls: { shape: "square", fill: "solid", case: "sentence", weight: "bold", link: "underline" },
    motif: { name: "Sunburst", from: "Their logo." },
    headline: "Tacos",
    line: "Family run.",
    photoTreatment: "plain",
    texture: "none",
    explores: false,
    pictures: { board: picture("board"), desktop: picture("desktop"), phone: picture("phone") },
  };
}

async function chosenBoard(businessId: string, letter: BoardLetter, feedback: string) {
  const drawn = await job(businessId, "done");
  const board = await store.saveBoards({ businessId, jobId: drawn.id, options: [option("a", "Chef's whites"), option("b", "Night market"), option("c", "Corner store")], pick: null });
  await store.chooseBoard(board.id, letter, feedback, "boris.nezlobin@gmail.com");
  return board;
}

test("a preview built from a chosen design names the option, who chose it and what they said", async () => {
  const business = await lead();
  const board = await chosenBoard(business.id, "a", "Warmer photos.");
  const build = await job(business.id, "done");
  await store.choiceForJob(business.id, build.id);

  const design = await builtDesignFor(business.id);
  assert.equal(design?.boardId, board.id);
  assert.equal(design?.letter, "a");
  assert.equal(design?.option.name, "Chef's whites");
  assert.equal(design?.by, "Boris");
  assert.equal(design?.feedback, "Warmer photos.");
  assert.ok(design?.at instanceof Date);
});

test("a choice whose first build failed and a retry built is the design of the preview", async () => {
  const business = await lead();
  await chosenBoard(business.id, "a", "");
  const failed = await job(business.id, "failed");
  await store.choiceForJob(business.id, failed.id);
  assert.equal(await builtDesignFor(business.id), null, "nothing built from it yet");
  await job(business.id, "done");
  assert.equal((await builtDesignFor(business.id))?.letter, "a");
});

test("a later choice whose build has not finished leaves the current preview on the earlier design", async () => {
  const business = await lead();
  await chosenBoard(business.id, "b", "");
  const first = await job(business.id, "done");
  await store.choiceForJob(business.id, first.id);

  await chosenBoard(business.id, "c", "");
  const second = await job(business.id, "running");
  await store.choiceForJob(business.id, second.id);

  assert.equal((await builtDesignFor(business.id))?.letter, "b");
  await database.update(previewJobs).set({ status: "done" }).where(eq(previewJobs.id, second.id));
  assert.equal((await builtDesignFor(business.id))?.letter, "c");
});

test("a business with no build after its choice, or no boards, has no built design", async () => {
  const business = await lead();
  await chosenBoard(business.id, "a", "");
  assert.equal(await builtDesignFor(business.id), null);
  assert.equal(await builtDesignFor((await lead()).id), null, "a business with no boards at all");
});
