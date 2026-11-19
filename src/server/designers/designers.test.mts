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
const { designerBusinesses } = await import("./work");
const { ledgerOf, recordPayment } = await import("./pay");
const { startDesignerSession, requireDesigner } = await import("../auth/designerSession");
const { requireFounder, startSession } = await import("../auth/session");
const { decisions } = await import("../boards/store");
const designerActions = await import("@/app/designer/(area)/actions");
const reviewActions = await import("@/app/designer/(area)/review/actions");
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

  await redirectsTo(() => designerActions.chooseAsDesignerAction(form({ id: theirs.board.id, letter: "a", feedback: "" })), /designer$/);
  const [untouched] = await database.select().from(designBoards).where(eq(designBoards.id, theirs.board.id));
  assert.equal(untouched.chosenAt, null, "Leo's business is left alone");

  await redirectsTo(() => designerActions.chooseAsDesignerAction(form({ id: mine.board.id, letter: "b", feedback: "Warmer photos." })), /designer$/);
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
  assert.deepEqual(await reviewActions.approveDesignerReviewAction(input), { ok: false, message: "This business isn't one of yours." });
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
