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
  assert.deepEqual(pictureName("c-narrow"), { letter: "c", view: "narrow" }, "the board for a phone, from a newer kit");
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
  assert.match(memory.markdown, /## Boris\n\n### Acme Heating\n/);
  assert.match(memory.markdown, /- Said: Quieter orange\./);
});

type Claim = { job: { id: string; note: string }; lead: { id: string }; boards?: boolean; board?: unknown; boardsAgain?: unknown; repair?: boolean };

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

test("a founder who wants none of the three gets three new designs, with their words and the option they had selected, and nothing is built from them", async () => {
  made += 1;
  const [lead] = await database.insert(businesses).values({ businessName: "Redrawn Bakery", slug: `boards-${made}`, linkCode: `boards-${made}`, website: `https://boards-${made}.example`, previewUrl: "https://redrawn-1.vercel.app" } as never).returning();
  await requestPreview(lead, "brendan@g.studio", "Start a new design.");
  const boardsJob = (await claimNextJob("runner-1"))!;
  await reportBoards(boardsJob.id, BoardsBody.parse({ options: threeOptions(lead.id) }));
  const board = (await store.waitingBoardFor(lead.id))!;
  assert.equal(await store.redrawFor(lead.id), null, "the boards still wait for a decision");
  const decidedBefore = (await store.boardsDecided()).length;

  assert.equal(await store.redrawBoards(board.id, "B is closest.", "brendan@g.studio", { selected: "d" as never }), null, "an option that isn't there can't be selected");
  const turnedDown = await store.redrawBoards(board.id, "  All three are too loud. B is closest.  ", "brendan@g.studio", { selected: "b" });
  assert.equal(turnedDown?.chosenLetter, "redrawn:b");
  assert.equal(await store.redrawBoards(board.id, "", "boris.nezlobin@gmail.com"), null, "the first decision stands");
  assert.equal(await store.chooseBoard(board.id, "a", "", "boris.nezlobin@gmail.com"), null, "and it can't be chosen from any more");
  assert.equal(await store.waitingBoardFor(lead.id), null);
  assert.equal((await store.boardsDecided()).length, decidedBefore, "a board turned down is not a choice: nothing is built from it");
  const learned = (await store.decisions()).find((decision) => decision.business === "Redrawn Bakery");
  assert.deepEqual([learned?.verdict, learned?.letter, learned?.by, learned?.feedback], ["redraw", "b", "Brendan", "All three are too loud. B is closest."], "but it teaches Brendan's taste");
  assert.deepEqual(await store.redrawFor(lead.id), { feedback: "All three are too loud. B is closest.", by: "Brendan", selected: "b", board: board.id });

  const redraw = await claimed(lead, await store.noteBehindBoards(board));
  assert.equal(redraw.job.note, "Start a new design.", "the note behind the first boards goes on");
  assert.equal(redraw.boards, true);
  assert.deepEqual(redraw.boardsAgain, { feedback: "All three are too loud. B is closest.", by: "Brendan", selected: "b", board: board.id }, "with the board it answers");
  assert.equal(redraw.board, undefined);
  assert.equal(redraw.repair, undefined);

  await reportBoards(redraw.job.id, BoardsBody.parse({ options: threeOptions(lead.id) }));
  assert.equal(await store.redrawFor(lead.id), null, "the new boards are the newest now, so nothing is drawn again");
  assert.ok(await store.waitingBoardFor(lead.id), "and they wait for a founder");
});

test("boards are drawn again when a founder asks, also for a lead whose note would otherwise be a repair or with boards switched off", async () => {
  made += 1;
  const [lead] = await database.insert(businesses).values({ businessName: "Switched Florist", slug: `boards-${made}`, linkCode: `boards-${made}`, website: `https://boards-${made}.example`, previewUrl: "https://switched-1.vercel.app" } as never).returning();
  await requestPreview(lead, "brendan@g.studio", "On / at phone width, the <h1>: too large.");
  const boardsJob = (await claimNextJob("runner-1"))!;
  await reportBoards(boardsJob.id, BoardsBody.parse({ options: threeOptions(lead.id) }));
  const board = (await store.waitingBoardFor(lead.id))!;
  await store.redrawBoards(board.id, "", "brendan@g.studio");
  const { updateRunnerSettings } = await import("../runner/settings");
  await updateRunnerSettings({ designBoards: false }, "brendan@g.studio");
  const redraw = await claimed(lead, await store.noteBehindBoards(board));
  await updateRunnerSettings({ designBoards: true }, "brendan@g.studio");
  assert.equal(redraw.boards, true);
  assert.deepEqual(redraw.boardsAgain, { feedback: "", by: "Brendan", board: board.id });
  assert.equal(redraw.repair, undefined, "a founder asked for designs, not for a change to the preview");
  await finish(redraw.job.id);
});

test("an option may carry its board for a phone, and one from somewhere else is refused like any picture", async () => {
  const { lead, job } = await leadWithRunningJob("Narrow Heating");
  const options = threeOptions(lead.id).map((entry) => ({ ...entry, pictures: { ...entry.pictures, narrow: `${STORE}/boards/${lead.id}/job/${entry.letter}-narrow-x1.jpg` } }));
  const stranger = structuredClone(options);
  stranger[2].pictures.narrow = "https://evil.example/c-narrow.jpg";
  await assert.rejects(() => reportBoards(job.id, BoardsBody.parse({ options: stranger })), /one this job uploaded/);
  await reportBoards(job.id, BoardsBody.parse({ options }));
  const board = (await store.waitingBoardFor(lead.id))!;
  assert.equal(board.options[1].pictures.narrow, `${STORE}/boards/${lead.id}/job/b-narrow-x1.jpg`);
  assert.equal(BoardsBody.parse({ options: threeOptions(lead.id) }).options[0].pictures.narrow, undefined, "an older runner sends none");
  await store.chooseBoard(board.id, "a", "", "brendan@g.studio");
});

test("a founder can have one option revised with their words: the runner is told which, and the new boards say what they revise", async () => {
  made += 1;
  const [lead] = await database.insert(businesses).values({ businessName: "Revised Tattoo", slug: `boards-${made}`, linkCode: `boards-${made}`, website: `https://boards-${made}.example` } as never).returning();
  await requestPreview(lead, "auto-queue");
  const boardsJob = (await claimNextJob("runner-1"))!;
  await reportBoards(boardsJob.id, BoardsBody.parse({ options: threeOptions(lead.id) }));
  const board = (await store.waitingBoardFor(lead.id))!;
  const decidedBefore = (await store.boardsDecided()).length;

  assert.equal(await store.redrawBoards(board.id, "Fonts too basic.", "boris.nezlobin@gmail.com", { base: "d" as never }), null, "an option that isn't there can't be revised");
  const revised = await store.redrawBoards(board.id, " Fonts too basic: answer their logo. ", "boris.nezlobin@gmail.com", { base: "c" });
  assert.equal(revised?.chosenLetter, "revise:c");
  assert.equal(await store.chooseBoard(board.id, "a", "", "brendan@g.studio"), null, "the first decision stands");
  assert.equal((await store.boardsDecided()).length, decidedBefore, "a revision is not a choice: nothing is built from it");
  assert.deepEqual(await store.redrawFor(lead.id), { feedback: "Fonts too basic: answer their logo.", by: "Boris", base: "c", board: board.id });

  const revision = await claimed(lead, await store.noteBehindBoards(board));
  assert.equal(revision.boards, true);
  assert.deepEqual(revision.boardsAgain, { feedback: "Fonts too basic: answer their logo.", by: "Boris", base: "c", board: board.id });
  assert.equal(revision.board, undefined, "nothing is built");

  await reportBoards(revision.job.id, BoardsBody.parse({ options: threeOptions(lead.id) }));
  const revisions = (await store.waitingBoardFor(lead.id))!;
  const of = await store.revisionOf(revisions);
  assert.equal(of?.option.letter, "c");
  assert.equal(of?.feedback, "Fonts too basic: answer their logo.");
  assert.equal(await store.revisionOf(board), null, "the first boards revise nothing");
  assert.equal(await store.redrawFor(lead.id), null);
});

test("an option may carry its whole page on a desktop and a phone, and how it is composed, which the next composer is told not to repeat", async () => {
  const { lead, job } = await leadWithRunningJob("Composed Tattoo");
  const picture = (letter: string, view: string) => `${STORE}/boards/${lead.id}/job/${letter}-${view}-x1.jpg`;
  const composition = (letter: string) => `A flash sheet of the artists' work with the booking ledger beside it (${letter}).`;
  const options = threeOptions(lead.id).map((entry) => ({ ...entry, composition: composition(entry.letter), pictures: { ...entry.pictures, page: picture(entry.letter, "page"), pagePhone: picture(entry.letter, "pagePhone") } }));
  assert.deepEqual(pictureName("b-pagePhone"), { letter: "b", view: "pagePhone" });
  const stranger = structuredClone(options);
  stranger[0].pictures.page = "https://evil.example/a-page.jpg";
  await assert.rejects(() => reportBoards(job.id, BoardsBody.parse({ options: stranger })), /one this job uploaded/);
  await reportBoards(job.id, BoardsBody.parse({ options }));
  const board = (await store.waitingBoardFor(lead.id))!;
  assert.equal(board.options[2].pictures.pagePhone, picture("c", "pagePhone"));
  assert.equal(board.options[0].composition, composition("a"));

  const memory = await boardMemory();
  assert.match(memory.compositions, /^# How recent boards composed their pages/);
  assert.ok(memory.compositions.includes(`- Composed Tattoo, A: ${composition("a")}`));
  await store.chooseBoard(board.id, "a", "", "brendan@g.studio");
});

test("boards name the lead as its build read it from the business's own site, when the lead finder guessed something else", async () => {
  const { lead, job } = await leadWithRunningJob("Los Angeles, CA");
  await reportBoards(job.id, BoardsBody.parse({ options: threeOptions(lead.id), business: " Life Art Creations Tattoo " }));
  const [renamed] = await database.select().from(businesses).where(eq(businesses.id, lead.id));
  assert.equal(renamed.businessName, "Life Art Creations Tattoo");
  assert.equal((await store.waitingBoardFor(lead.id)) !== null, true);
  const { lead: kept, job: second } = await leadWithRunningJob("Keeps Its Name");
  await reportBoards(second.id, BoardsBody.parse({ options: threeOptions(kept.id) }));
  const [same] = await database.select().from(businesses).where(eq(businesses.id, kept.id));
  assert.equal(same.businessName, "Keeps Its Name", "a runner that sends no name renames nothing");
});

test("every waiting design can be drawn again at once, with no founder's words and no lesson, and a decided one is left alone", async () => {
  for (const board of await store.boardsWaiting()) await store.chooseBoard(board.id, "a", "", "boris.nezlobin@gmail.com");
  const { lead: first, job: firstJob } = await leadWithRunningJob("First Waiting");
  await reportBoards(firstJob.id, BoardsBody.parse({ options: threeOptions(first.id) }));
  const { lead: second, job: secondJob } = await leadWithRunningJob("Second Waiting");
  await reportBoards(secondJob.id, BoardsBody.parse({ options: threeOptions(second.id) }));
  const replaced = await store.redrawWaiting("boris.nezlobin@gmail.com");
  assert.deepEqual(replaced.map((board) => board.businessId).sort(), [first.id, second.id].sort());
  assert.deepEqual([...new Set(replaced.map((board) => board.chosenLetter))], ["replaced"]);
  assert.equal(await store.countBoardsWaiting(), 0);
  for (const lead of [first, second]) assert.deepEqual(await store.redrawFor(lead.id), { feedback: "", by: "Boris", replaced: true, board: replaced.find((board) => board.businessId === lead.id)!.id });
  const learned = (await store.decisions()).map((decision) => decision.business);
  assert.ok(!learned.includes("First Waiting") && !learned.includes("Second Waiting"), "Redraw all judged the system, not the designs");
  assert.deepEqual(await store.redrawWaiting("boris.nezlobin@gmail.com"), [], "nothing waits any more");
});
