/**
 * Design boards: what the runner sends, a founder's choice, and what the next build is told.
 *
 *   npm test
 *
 * Runs against an in-memory Postgres (PGlite) migrated from drizzle/.
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { BoardLetter } from "@/lib/boards";
import { startEmptyTestDatabase } from "../emptyTestDatabase";

mock.module("server-only", { namedExports: {} });
process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";
// The store's ID is the third part of the token, and its files are served from <id>.public.blob.vercel-storage.com.
process.env.BRAND_FILES_READ_WRITE_TOKEN = "vercel_blob_rw_TestStore_secret";
const STORE = "https://teststore.public.blob.vercel-storage.com";

const closeDatabase = await startEmptyTestDatabase();
const { db } = await import("../db/client");
const { businesses, previewJobs } = await import("../db/schema");
const { eq } = await import("drizzle-orm");
const store = await import("./store");
const { isBoardPicture, pictureName } = await import("./pictures");
const { BoardsBody, boardMemory, reportBoards } = await import("../runner/boards");
const { buildsToday, claimNextJob, requestPreview } = await import("../runner/jobs");
const { BOARDS_STEP, isBoards, buildOutcome } = await import("@/lib/previewJobs");
const database = await db();

let made = 0;
async function leadWithRunningJob(name: string) {
  made += 1;
  const [lead] = await database.insert(businesses).values({ businessName: name, slug: `boards-${made}`, linkCode: `boards-${made}`, website: `https://boards-${made}.example` } as never).returning();
  await requestPreview(lead, "auto-queue");
  const job = (await claimNextJob("runner-1"))!;
  return { lead, job };
}

function option(letter: BoardLetter, businessId: string, layout: string) {
  const picture = (view: string) => `${STORE}/boards/${businessId}/job/${letter}-${view}-x1.jpg`;
  return {
    letter,
    boldness: letter === "a" ? 1 : letter === "b" ? 2 : 3,
    name: `Direction ${letter}`,
    idea: "An idea.",
    palette: { background: "#faf3e3", accent: "#b23c17" },
    fonts: { heading: "Zilla Slab", body: "DM Sans" },
    layout,
    controls: { shape: "square", fill: "solid", case: "sentence", weight: "bold", link: "underline" },
    motif: { name: "Sunburst", from: "Their logo." },
    headline: "Heating and cooling",
    line: "Family run.",
    photoTreatment: "plain",
    texture: "none",
    explores: letter === "c",
    pictures: { board: picture("board"), desktop: picture("desktop"), phone: picture("phone") },
  };
}

const threeOptions = (businessId: string) => [option("a", businessId, "split-hero"), option("b", businessId, "type-led"), option("c", businessId, "editorial")];

test("a picture counts only when it is in our store, in the lead's boards folder", () => {
  assert.ok(isBoardPicture(`${STORE}/boards/lead-1/job/a-board.jpg`, "lead-1"));
  assert.ok(!isBoardPicture(`${STORE}/boards/lead-2/job/a-board.jpg`, "lead-1"), "another lead's folder");
  assert.ok(!isBoardPicture(`${STORE}/brand/lead-1/logo.png`, "lead-1"), "not a board");
  assert.ok(!isBoardPicture("https://evil.example/boards/lead-1/a-board.jpg", "lead-1"), "another host");
  assert.deepEqual(pictureName("b-desktop"), { letter: "b", view: "desktop" });
  assert.equal(pictureName("d-board"), null);
  assert.equal(pictureName("a-poster"), null);
});

test("the runner's boards end its job without using up a build, and wait for a founder", async () => {
  const { lead, job } = await leadWithRunningJob("Acme Heating");
  const before = await buildsToday();
  const body = BoardsBody.parse({ options: threeOptions(lead.id), pick: { letter: "b", reason: "They choose dark pages." } });
  const { board: boardId } = await reportBoards(job.id, body);
  const [finished] = await database.select().from(previewJobs).where(eq(previewJobs.id, job.id));
  assert.equal(finished.status, "done");
  assert.equal(finished.step, BOARDS_STEP);
  assert.ok(isBoards(finished) && buildOutcome(finished) === "boards");
  assert.equal(await buildsToday(), before - 1, "a job that only made boards is not a build");
  const waiting = await store.boardsWaiting();
  assert.deepEqual(waiting.map((board) => [board.id, board.businessName]), [[boardId, "Acme Heating"]]);
  assert.equal(await store.countBoardsWaiting(), 1);
  assert.equal((await store.waitingBoardFor(lead.id))?.id, boardId);
  await assert.rejects(() => reportBoards(job.id, body), /not a preview being built/, "a finished job sends nothing more");
});

test("boards with a picture from somewhere else, or a repeated letter, are refused", async () => {
  const { lead, job } = await leadWithRunningJob("Stranger Plumbing");
  const stranger = threeOptions(lead.id);
  stranger[1].pictures.phone = "https://evil.example/x.jpg";
  await assert.rejects(() => reportBoards(job.id, BoardsBody.parse({ options: stranger })), /one this job uploaded/);
  const repeated = threeOptions(lead.id);
  repeated[2].letter = "a";
  await assert.rejects(() => reportBoards(job.id, BoardsBody.parse({ options: repeated })), /its own letter/);
  assert.throws(() => BoardsBody.parse({ options: threeOptions(lead.id).slice(0, 2) }), "two options are not three");
});

test("the first founder's choice stands, queues nothing by itself, and is carried by the job that builds it", async () => {
  const [waiting] = await store.boardsWaiting();
  assert.equal(await store.chooseBoard(waiting.id, "c" as BoardLetter, "  Quieter orange.  ", "boris.nezlobin@gmail.com").then((board) => board?.chosenLetter), "c");
  assert.equal(await store.chooseBoard(waiting.id, "a", "", "brendan@g.studio"), null, "already chosen");
  assert.equal(await store.chooseBoard("00000000-0000-0000-0000-000000000000", "a", "", "brendan@g.studio"), null);
  assert.equal(await store.countBoardsWaiting(), 0);
  assert.equal(await store.waitingBoardFor(waiting.businessId), null);

  const [lead] = await database.select().from(businesses).where(eq(businesses.id, waiting.businessId));
  await requestPreview(lead, "boris.nezlobin@gmail.com");
  const build = (await claimNextJob("runner-1"))!;
  assert.deepEqual(await store.choiceForJob(lead.id, build.id), { letter: "c", feedback: "Quieter orange.", by: "Boris" });
  assert.deepEqual(await store.choiceForJob(lead.id, build.id), { letter: "c", feedback: "Quieter orange.", by: "Boris" }, "the same job, cut off and claimed again");
  assert.equal(await store.choiceForJob(lead.id, "11111111-1111-1111-1111-111111111111"), null, "a later rebuild does not carry the choice again");
});

test("decided boards teach the next build", async () => {
  const memory = await boardMemory();
  assert.equal(memory.decided, 1);
  assert.deepEqual(memory.agreement, { matched: 0, of: 1 }, "the system picked B and the founder chose C");
  assert.ok(memory.preferences.layouts.editorial > 1 && memory.preferences.layouts["split-hero"] < 1);
  assert.match(memory.markdown, /## Acme Heating \(chosen by Boris\)/);
  assert.match(memory.markdown, /- Said: Quieter orange\./);
  await closeDatabase();
});
