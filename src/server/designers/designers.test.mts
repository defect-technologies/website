/**
 * Student designers: their session reaches only the designer area, a business belongs to the first designer who takes
 * it, their decisions are recorded under their name, and what they are owed is worked out from what they earned.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
import { startEmptyTestDatabase } from "../emptyTestDatabase";

process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";
process.env.ADMIN_EMAILS = "boris.nezlobin@gmail.com,brendan@g.studio";
const cookieJar = new Map<string, string>();
mock.module("server-only", { namedExports: {} });
mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({
      get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
      set: (name: string, value: string) => void cookieJar.set(name, value),
      delete: (name: string) => void cookieJar.delete(name),
    }),
  },
});
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });
mock.module("next/navigation", {
  namedExports: {
    redirect: (url: string) => {
      throw Object.assign(new Error(`Redirected to ${url}`), { digest: `NEXT_REDIRECT;replace;${url};307;` });
    },
    notFound: () => {
      throw new Error("Not found");
    },
  },
});

const closeDatabase = await startEmptyTestDatabase();
after(closeDatabase);
const { eq } = await import("drizzle-orm");
const { db } = await import("../db/client");
const { businesses, designBoards, previewJobs } = await import("../db/schema");
const { addDesigner, activeDesignerByEmail, setDesignerActive } = await import("./people");
const { claimBoard, pool } = await import("./claims");
const { designerBusinesses, releaseUnfinished } = await import("./work");
const { ledgerOf, recordPayment } = await import("./pay");
const { startDesignerSession, requireDesigner } = await import("../auth/designerSession");
const { requireFounder, startSession } = await import("../auth/session");
const { decisions } = await import("../boards/store");
const designerActions = await import("@/app/designer/(area)/actions");
const reviewActions = await import("@/app/designer/(area)/review/actions");
const trackedLink = await import("@/app/p/[code]/route");
const database = await db();

const MAYA = "maya@example.com";
const LEO = "leo@example.com";

async function designer(email: string, name: string) {
  await addDesigner(name, email, "boris.nezlobin@gmail.com");
  return (await activeDesignerByEmail(email))!;
}

async function signInAs(email: string) {
  cookieJar.clear();
  await startDesignerSession((await activeDesignerByEmail(email))!);
}

let made = 0;
async function waitingBoard(name = `Shop ${made + 1}`) {
  made += 1;
  const [lead] = await database.insert(businesses).values({ businessName: name, slug: `designer-${made}`, linkCode: `designer-${made}`, website: `https://designer-${made}.example`, email: `owner@designer-${made}.example` }).returning();
  const [job] = await database.insert(previewJobs).values({ businessId: lead.id, requestedBy: "auto-queue", status: "done" }).returning();
  const options = ["a", "b", "c"].map((letter) => ({ letter, name: `Direction ${letter}`, layout: `layout-${letter}`, fonts: { heading: "Tinos", body: "DM Sans" }, palette: {}, controls: {}, motif: {}, pictures: { board: "", desktop: "", phone: "" } }));
  const [board] = await database.insert(designBoards).values({ businessId: lead.id, jobId: job.id, options, pick: null } as never).returning();
  return { lead, board };
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

const redirectsTo = async (work: () => Promise<unknown>, path: RegExp) => assert.rejects(work, (error: Error) => path.test(error.message));

const maya = await designer(MAYA, "Maya");
const leo = await designer(LEO, "Leo");

beforeEach(() => cookieJar.clear());

test("a designer's session never passes the founders' gate, and a founder's never the designers'", async () => {
  await signInAs(MAYA);
  assert.equal((await requireDesigner()).email, MAYA);
  await redirectsTo(() => requireFounder(), /admin\/sign-in/);
  cookieJar.clear();
  await startSession({ email: "boris.nezlobin@gmail.com", name: "Boris" });
  await redirectsTo(() => requireDesigner(), /admin\/sign-in/);
});

test("deactivating a designer signs them out, and adding a designer twice is refused", async () => {
  const sam = await designer("sam@example.com", "Sam");
  await signInAs("sam@example.com");
  await setDesignerActive(sam.id, false, "boris.nezlobin@gmail.com");
  await redirectsTo(() => requireDesigner(), /admin\/sign-in/);
  assert.equal(await addDesigner("Sam again", "SAM@example.com ", "brendan@g.studio"), "exists");
});

test("a business goes to the first designer who takes it, and leaves the pool", async () => {
  const { board } = await waitingBoard();
  const [first, second] = await Promise.all([claimBoard(board.id, maya.id), claimBoard(board.id, leo.id)]);
  assert.deepEqual([first.result, second.result].sort(), ["claimed", "taken"]);
  const winner = first.result === "claimed" ? maya : leo;
  assert.equal((await claimBoard(board.id, winner.id)).result, "yours");
  assert.ok(!(await pool()).some((waiting) => waiting.id === board.id));
});

test("a designer decides only their own business's designs, under their own name", async () => {
  const mine = await waitingBoard("Talin Market");
  const theirs = await waitingBoard();
  await claimBoard(mine.board.id, maya.id);
  await claimBoard(theirs.board.id, leo.id);
  await signInAs(MAYA);

  await redirectsTo(() => designerActions.chooseAsDesignerAction(form({ id: theirs.board.id, letter: "a", feedback: "" })), /designer\?missed=taken$/);
  const [untouched] = await database.select().from(designBoards).where(eq(designBoards.id, theirs.board.id));
  assert.equal(untouched.chosenAt, null, "Leo's business is left alone");

  await redirectsTo(() => designerActions.chooseAsDesignerAction(form({ id: mine.board.id, letter: "b", feedback: "Warmer photos." })), /designer\?done=building$/);
  const [chosen] = await database.select().from(designBoards).where(eq(designBoards.id, mine.board.id));
  assert.equal(chosen.chosenLetter, "b");
  assert.equal(chosen.chosenBy, MAYA);
  const [job] = await database.select().from(previewJobs).where(eq(previewJobs.businessId, mine.lead.id)).orderBy(previewJobs.createdAt);
  assert.ok(job, "the build is queued");
  const learned = (await decisions()).find((decision) => decision.business === "Talin Market");
  assert.deepEqual([learned?.by, learned?.role, learned?.feedback], ["Maya", "designer", "Warmer photos."]);
});

test("a designer's review actions refuse a business that isn't theirs", async () => {
  const theirs = await waitingBoard();
  await claimBoard(theirs.board.id, leo.id);
  await signInAs(MAYA);
  const input = { businessId: theirs.lead.id, previewUrl: "https://shop.vercel.app", notes: [] };
  assert.deepEqual(await reviewActions.approveDesignerReviewAction(input), { ok: false, message: "This design isn't one of yours." });
  assert.deepEqual(await reviewActions.designerAsksAction(theirs.lead.id), { previewUrl: "", asks: [] });
});

test("a designer's businesses carry their status and earnings, never the owner's contact details", async () => {
  const paid = await waitingBoard("Paid Bakery");
  await claimBoard(paid.board.id, leo.id);
  await database.update(designBoards).set({ chosenLetter: "a", chosenAt: new Date(), chosenBy: LEO }).where(eq(designBoards.id, paid.board.id));
  await database.update(businesses).set({ stage: "paid", paidAt: new Date(), plan: "$59/month", firstSentAt: new Date(), ownerEmail: "owner@bakery.example" }).where(eq(businesses.id, paid.lead.id));
  const rows = await designerBusinesses(leo.id);
  const bakery = rows.find((row) => row.businessName === "Paid Bakery")!;
  assert.equal(bakery.status, "client");
  assert.equal(bakery.earnedCents, 5900);
  for (const row of rows) for (const key of ["email", "ownerEmail", "ownerFirstName", "threadId", "plan"]) assert.ok(!(key in row), `${key} is not handed to a designer`);

  await recordPayment({ designerId: leo.id, amountCents: 2000, paidOn: "2026-11-17", note: "Zelle", recordedBy: "brendan@g.studio" });
  const ledger = await ledgerOf(leo.id);
  assert.deepEqual([ledger.earnedCents, ledger.paidCents, ledger.owedCents], [5900, 2000, 3900]);
  assert.equal(ledger.payments[0].recordedBy, "brendan@g.studio");
});

test("a business with any build queued is building, even when a newer job only drew its designs", async () => {
  const { lead, board } = await waitingBoard("Queued Before Boards");
  await claimBoard(board.id, maya.id);
  await database.insert(previewJobs).values({ businessId: lead.id, requestedBy: "bot:outreach", status: "queued", createdAt: new Date(Date.now() - 60_000) });
  await database.update(designBoards).set({ chosenLetter: "b", chosenAt: new Date(), chosenBy: MAYA }).where(eq(designBoards.id, board.id));
  const row = (await designerBusinesses(maya.id)).find((business) => business.id === lead.id);
  assert.equal(row?.status, "building");
});

test("a leaving designer's unfinished designs go back to the pool, and the finished ones stay theirs", async () => {
  const kai = await designer("kai@example.com", "Kai");
  const unfinished = await waitingBoard("Half Done Deli");
  const finished = await waitingBoard("Sent Salon");
  await claimBoard(unfinished.board.id, kai.id);
  await claimBoard(finished.board.id, kai.id);
  await database.update(designBoards).set({ chosenLetter: "a", chosenAt: new Date(), chosenBy: "kai@example.com" }).where(eq(designBoards.id, finished.board.id));
  await database.update(businesses).set({ stage: "sent", previewUrl: "https://salon.vercel.app", firstSentAt: new Date() }).where(eq(businesses.id, finished.lead.id));

  assert.equal(await releaseUnfinished(kai.id), 1);
  assert.ok((await pool()).some((waiting) => waiting.id === unfinished.board.id), "the deli's designs wait for another designer");
  assert.deepEqual((await designerBusinesses(kai.id)).map((row) => row.businessName), ["Sent Salon"]);
});

test("a payment marks the oldest sign-up paid and leaves a newer one owed", async () => {
  const ana = await designer("ana@example.com", "Ana");
  for (const [name, daysAgo] of [["Old Optician", 20], ["New Nursery", 1]] as const) {
    const { lead, board } = await waitingBoard(name);
    await claimBoard(board.id, ana.id);
    await database.update(designBoards).set({ chosenLetter: "a", chosenAt: new Date(), chosenBy: "ana@example.com" }).where(eq(designBoards.id, board.id));
    await database.update(businesses).set({ stage: "paid", paidAt: new Date(Date.now() - daysAgo * 86_400_000), plan: "$79/month", firstSentAt: new Date(Date.now() - 30 * 86_400_000) }).where(eq(businesses.id, lead.id));
  }
  await recordPayment({ designerId: ana.id, amountCents: 7900, paidOn: "2026-11-17", note: "", recordedBy: "boris.nezlobin@gmail.com" });
  const ledger = await ledgerOf(ana.id);
  assert.deepEqual(ledger.earned.map((earning) => [earning.businessName, earning.settled]), [["New Nursery", false], ["Old Optician", true]]);
  assert.equal(ledger.owedCents, 7900);
});

test("the tracked link counts the business's opens, never a founder's or a designer's", async () => {
  const { lead } = await waitingBoard("Opened Optics");
  await database.update(businesses).set({ previewUrl: "https://optics.vercel.app", firstSentAt: new Date(), stage: "sent" }).where(eq(businesses.id, lead.id));
  const open = () => trackedLink.GET(new Request("https://defect.tech/p/x") as never, { params: Promise.resolve({ code: lead.linkCode }) });
  const opens = async () => (await database.select().from(businesses).where(eq(businesses.id, lead.id)))[0].clickCount;

  await startSession({ email: "boris.nezlobin@gmail.com", name: "Boris" });
  await open();
  await signInAs(MAYA);
  await open();
  assert.equal(await opens(), 0, "our own clicks");
  cookieJar.clear();
  await open();
  assert.equal(await opens(), 1, "the business's click");
});

test("marking a designer paid records exactly what they are owed, and a second click records nothing", async () => {
  const setupActions = await import("@/app/admin/(panel)/setup/designers/actions");
  const rio = await designer("rio@example.com", "Rio");
  const { lead, board } = await waitingBoard("Settled Surf Shop");
  await claimBoard(board.id, rio.id);
  await database.update(designBoards).set({ chosenLetter: "a", chosenAt: new Date(), chosenBy: "rio@example.com" }).where(eq(designBoards.id, board.id));
  await database.update(businesses).set({ stage: "paid", paidAt: new Date(), plan: "$79/month", firstSentAt: new Date() }).where(eq(businesses.id, lead.id));
  await startSession({ email: "brendan@g.studio", name: "Brendan" });

  await setupActions.settleDesignerAction(form({ id: rio.id }));
  await setupActions.settleDesignerAction(form({ id: rio.id }));
  const ledger = await ledgerOf(rio.id);
  assert.deepEqual(ledger.payments.map((payment) => payment.amountCents), [7900]);
  assert.equal(ledger.owedCents, 0);
});

test("deciding on an open design makes it the designer's, with no step before it", async () => {
  const { lead, board } = await waitingBoard("Open Bakery");
  await signInAs(MAYA);
  await redirectsTo(() => designerActions.redrawAsDesignerAction(form({ id: board.id, feedback: "Bigger bread." })), /designer\?done=drawing$/);
  assert.ok((await designerBusinesses(maya.id)).some((row) => row.id === lead.id), "the bakery is Maya's");
  assert.ok(!(await pool()).some((waiting) => waiting.id === board.id), "and leaves the open designs");
  await signInAs(LEO);
  await redirectsTo(() => designerActions.chooseAsDesignerAction(form({ id: board.id, letter: "a", feedback: "" })), /designer\?missed=/);
});
