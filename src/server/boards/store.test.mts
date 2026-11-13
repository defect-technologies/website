/**
 * Design boards: what the runner sends, a founder's choice, and what the next build is told.
 *
 *   npm test
 *
 * Runs against an in-memory Postgres (PGlite) migrated from drizzle/.
 */
import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import type { BoardLetter } from "@/lib/boards";
import { startEmptyTestDatabase } from "../emptyTestDatabase";

mock.module("server-only", { namedExports: {} });
process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";
// The store's ID is the third part of the token, and its files are served from <id>.public.blob.vercel-storage.com.
process.env.BRAND_FILES_READ_WRITE_TOKEN = "vercel_blob_rw_TestStore_secret";
const STORE = "https://teststore.public.blob.vercel-storage.com";

const closeDatabase = await startEmptyTestDatabase();
after(closeDatabase);
const { db } = await import("../db/client");
const { businesses, previewJobs } = await import("../db/schema");
const { eq } = await import("drizzle-orm");
const store = await import("./store");
const { isBoardPicture, pictureName } = await import("./pictures");
const { BoardsBody, boardMemory, reportBoards } = await import("../runner/boards");
const { buildsToday, claimNextJob, requestPreview } = await import("../runner/jobs");
const { claimNext } = await import("../runner/api");
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
});

type Claim = { job: { id: string; note: string }; lead: { id: string }; boards?: boolean; board?: unknown; repair?: boolean };

/**
 * What the runner is handed for the lead's next job, as GET /api/runner/next answers it. It asks under its own name:
 * the admin puts a runner's unfinished claims back in the queue, and the tests above leave some under "runner-1".
 */
async function claimed(lead: { id: string }, note: string) {
  const [current] = await database.select().from(businesses).where(eq(businesses.id, lead.id));
  await requestPreview(current, "brendan@g.studio", note);
  const claim = (await claimNext({ name: "runner-1" } as never, new Request("https://defect.tech/api/runner/next?runner=runner-notes"))) as Claim;
  assert.equal(claim.lead.id, lead.id, "the job claimed is the one just queued");
  return claim;
}

async function finish(jobId: string) {
  await database.update(previewJobs).set({ status: "done", finishedAt: new Date() }).where(eq(previewJobs.id, jobId));
}

test("a founder's note about a built preview gets no boards, so the build keeps the design the note is about", async () => {
  made += 1;
  const [lead] = await database.insert(businesses).values({ businessName: "Noted Roofing", slug: `boards-${made}`, linkCode: `boards-${made}`, website: `https://boards-${made}.example` } as never).returning();
  const first = await claimed(lead, "Their site is good, build it anyway.");
  assert.equal(first.boards, true, "no preview yet: the first build makes boards, note or not");
  assert.equal(first.repair, undefined, "and there is nothing built to repair");
  await finish(first.job.id);

  await database.update(businesses).set({ previewUrl: "https://noted-roofing-1.vercel.app" }).where(eq(businesses.id, lead.id));
  const change = await claimed(lead, "On / at phone width, the <h1>: too large.");
  assert.equal(change.boards, undefined, "boards would stop this build and replace the design");
  assert.equal(change.repair, true, "the note's changes are made on the built site as it is");
  await finish(change.job.id);

  const fresh = await claimed(lead, "Start a new design.\nMake it bolder.");
  assert.equal(fresh.boards, true);
  assert.equal(fresh.repair, undefined);
  await finish(fresh.job.id);

  const again = await claimed(lead, "");
  assert.equal(again.boards, true, "a build with no note is a new build");
  await finish(again.job.id);
});

test("the job that builds a founder's choice carries the note of the job that made the boards", async () => {
  made += 1;
  const [lead] = await database.insert(businesses).values({ businessName: "Carried Electric", slug: `boards-${made}`, linkCode: `boards-${made}`, website: `https://boards-${made}.example`, previewUrl: "https://carried-1.vercel.app" } as never).returning();
  const { RETRY_NOTE } = await import("@/lib/previewJobs");
  await requestPreview(lead, "brendan@g.studio", `Start a new design.\nUse their red.\n\n${RETRY_NOTE}`);
  const boardsJob = (await claimNextJob("runner-1"))!;
  await reportBoards(boardsJob.id, BoardsBody.parse({ options: threeOptions(lead.id) }));
  const board = (await store.waitingBoardFor(lead.id))!;
  assert.equal(await store.noteBehindBoards(board), "Start a new design.\nUse their red.", "the founder's words, without the automatic retry's");
  await store.chooseBoard(board.id, "b", "", "brendan@g.studio");

  const build = await claimed(lead, await store.noteBehindBoards(board));
  assert.equal(build.job.note, "Start a new design.\nUse their red.");
  assert.equal(build.boards, true);
  assert.deepEqual(build.board, { letter: "b", feedback: "", by: "Brendan" });
  await finish(build.job.id);

  await store.chooseBoard((await boardFromNotedPreview(lead)).id, "a", "", "brendan@g.studio");
  const chosen = await claimed(lead, "On / at phone width, the <h1>: too large.");
  assert.equal(chosen.boards, true, "a choice is always built, also with a note about the preview");
  assert.equal(chosen.repair, undefined, "so its job is not a repair");
  assert.deepEqual(chosen.board, { letter: "a", feedback: "", by: "Brendan" });
  await finish(chosen.job.id);
});

/** Boards an older runner made from a note about a built preview: they wait, and a founder may still choose from them. */
async function boardFromNotedPreview(lead: { id: string }) {
  const [current] = await database.select().from(businesses).where(eq(businesses.id, lead.id));
  await requestPreview(current, "brendan@g.studio", "On / at phone width, the <h1>: too large.");
  const job = (await claimNextJob("runner-1"))!;
  await reportBoards(job.id, BoardsBody.parse({ options: threeOptions(lead.id) }));
  return (await store.waitingBoardFor(lead.id))!;
}
