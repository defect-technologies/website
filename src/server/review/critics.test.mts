/**
 * The critics' settings, the notes a build reports, the proposals the review page asks about, and the founder's answers.
 *
 *   npm test
 *
 * Runs against an in-memory Postgres (PGlite) migrated from drizzle/.
 */
import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema";

mock.module("server-only", {});
process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";
delete process.env.ANTHROPIC_API_KEY;

const pglite = new PGlite();
const database = drizzle(pglite, { schema });
(globalThis as { defectDb?: Promise<unknown> }).defectDb = Promise.resolve(database);

const { CriticNotesField } = await import("./criticNotes");
const { criticSettings, updateCriticSettings } = await import("./criticSettings");
const { kindTallies, proposalsForPreview, recordProposalAnswer } = await import("./criticProposals");
const { reviewQuestionsFor } = await import("./askWriter");
const { classifyTexts, withClasses } = await import("./noteClassifier");
const { splitSpokenNotes } = await import("./noteWriter");
const { DoneBody } = await import("../runner/api");

const PREVIEW = "https://sample.vercel.app/";

const criticNote = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  target: "section",
  kind: "text",
  path: "/",
  device: "phone",
  selector: "main > section:nth-of-type(2)",
  quote: "Words",
  text: "Cut this to two sentences.",
  source: "verify:density",
  model: "measured",
  status: "proposed",
  ...overrides,
});

let businessId = "";
const insertJob = async (criticNotes: unknown, finishedAt = new Date()) => {
  const [job] = await database
    .insert(schema.previewJobs)
    .values({ businessId, status: "done", requestedBy: "test", previewUrl: PREVIEW, finishedAt, criticNotes: criticNotes as never })
    .returning();
  return job;
};

before(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });
  const [business] = await database.insert(schema.businesses).values({ slug: "sample", linkCode: "abc", businessName: "Sample", previewUrl: PREVIEW }).returning();
  businessId = business.id;
});

after(async () => {
  await pglite.close();
});

describe("settings", () => {
  it("start with everything off, as the contract lists them", async () => {
    assert.deepEqual(await criticSettings(), { enabled: false, minutes: 20, apply: [], maxNotes: 24, secondBuilder: false });
  });

  it("keep what a founder saves, in kind order, and refuse values that make no sense", async () => {
    const saved = await updateCriticSettings({ enabled: true, minutes: 30, apply: ["spacing", "text", "text"] }, "founder@example.com");
    assert.deepEqual(saved.apply, ["text", "spacing"]);
    assert.deepEqual(await criticSettings(), { enabled: true, minutes: 30, apply: ["text", "spacing"], maxNotes: 24, secondBuilder: false });
    await assert.rejects(updateCriticSettings({ minutes: 0 }, "founder@example.com"));
    await assert.rejects(updateCriticSettings({ apply: ["nonsense" as never] }, "founder@example.com"));
    await updateCriticSettings({ enabled: false, minutes: 20, apply: [] }, "founder@example.com");
  });
});

describe("the notes a build reports", () => {
  it("accept a report with none, and a report with fields this version does not know", () => {
    const without = DoneBody.safeParse({ status: "done", previewUrl: PREVIEW });
    assert.equal(without.success, true);
    assert.equal(without.success && without.data.criticNotes, undefined);
    const newer = DoneBody.safeParse({ status: "done", previewUrl: PREVIEW, somethingNew: 1, criticNotes: [{ ...criticNote("a"), confidence: 0.9 }] });
    assert.equal(newer.success, true);
    assert.deepEqual(Object.keys(newer.success ? (newer.data.criticNotes?.[0] ?? {}) : {}).sort(), Object.keys(criticNote("a")).sort());
  });

  it("keep the first 80 and never fail a report for sending more", () => {
    const eighty = Array.from({ length: 80 }, (_, index) => criticNote(`n${index}`));
    assert.equal(CriticNotesField.parse(eighty)?.length, 80);
    const kept = CriticNotesField.parse([...eighty, criticNote("one-more")]);
    assert.equal(kept?.length, 80);
    assert.equal(kept?.some((note) => note.id === "one-more"), false);
  });

  it("leave out a note that is invalid, too long, or repeats an id, and keep the rest", () => {
    const parsed = CriticNotesField.parse([
      criticNote("ok"),
      criticNote("ok"),
      criticNote("bad-kind", { kind: "newer-kind" }),
      criticNote("long-text", { text: "x".repeat(601) }),
      criticNote("long-quote", { quote: "x".repeat(81) }),
      criticNote("no-text", { text: "  " }),
      "not an object",
    ]);
    assert.deepEqual(parsed?.map((each) => each.id), ["ok"]);
  });
});

describe("proposals for a preview", () => {
  it("are none when the newest finished job reported nothing, so the page falls back to Claude's own questions", async () => {
    await insertJob(null);
    assert.equal(await proposalsForPreview(businessId, PREVIEW), null);
    assert.deepEqual(await reviewQuestionsFor(businessId, "Sample", PREVIEW), []);
    await database.delete(schema.previewJobs);
  });

  it("are none when every note was applied", async () => {
    await insertJob([criticNote("a", { status: "applied" })]);
    assert.equal(await proposalsForPreview(businessId, PREVIEW), null);
    await database.delete(schema.previewJobs);
  });

  it("come only from the newest finished job, and replace the fallback questions", async () => {
    await insertJob([criticNote("old")], new Date(Date.now() - 60_000));
    const newest = await insertJob([criticNote("seam-1", { target: "seam", kind: "cohesion" }), criticNote("sys-1", { target: "system", selector: "", kind: "font", status: "open" }), criticNote("done-1", { status: "applied" })]);
    const asks = await reviewQuestionsFor(businessId, "Sample", PREVIEW);
    assert.deepEqual(asks.map((ask) => ask.proposal?.id), ["sys-1", "seam-1"]);
    assert.equal(asks[0].proposal?.jobId, newest.id);
    assert.equal(asks[0].question, "Cut this to two sentences");
  });

  it("do not come back once answered, and stay empty rather than falling back when all are answered", async () => {
    const [job] = await database.select().from(schema.previewJobs).orderBy(schema.previewJobs.finishedAt);
    const newest = (await database.select().from(schema.previewJobs)).find((each) => each.criticNotes?.some((note) => note.id === "sys-1")) ?? job;
    assert.equal(await recordProposalAnswer({ jobId: newest.id, proposalId: "sys-1", accepted: true, answeredBy: "founder@example.com" }), true);
    assert.deepEqual((await reviewQuestionsFor(businessId, "Sample", PREVIEW)).map((ask) => ask.proposal?.id), ["seam-1"]);
    assert.equal(await recordProposalAnswer({ jobId: newest.id, proposalId: "seam-1", accepted: false, answeredBy: "founder@example.com" }), true);
    assert.deepEqual(await reviewQuestionsFor(businessId, "Sample", PREVIEW), []);
  });

  it("keep the kind and target from the stored note, and refuse a proposal the job never reported", async () => {
    const newest = (await database.select().from(schema.previewJobs)).find((each) => each.criticNotes?.some((note) => note.id === "sys-1"));
    assert.ok(newest);
    assert.equal(await recordProposalAnswer({ jobId: newest.id, proposalId: "made-up", accepted: true, answeredBy: "x" }), false);
    const [answer] = await database.select().from(schema.criticAnswers);
    assert.equal(answer.kind === "font" || answer.kind === "cohesion", true);
    assert.equal(answer.businessId, businessId);
  });

  it("keep one answer per proposal when the founder changes his mind", async () => {
    const newest = (await database.select().from(schema.previewJobs)).find((each) => each.criticNotes?.some((note) => note.id === "sys-1"));
    assert.ok(newest);
    await recordProposalAnswer({ jobId: newest.id, proposalId: "sys-1", accepted: false, answeredBy: "founder@example.com" });
    const answers = await database.select().from(schema.criticAnswers);
    assert.equal(answers.length, 2);
    assert.equal(answers.find((each) => each.proposalId === "sys-1")?.accepted, false);
  });
});

describe("the numbers per kind", () => {
  it("add the answers to the notes the founder wrote himself that no proposal led to", async () => {
    const note = (id: string, kind: string, proposalId?: string) => ({ id, text: "t", scope: "site", device: "phone", path: "/", anchor: null, kind, proposalId });
    await database.insert(schema.previewReviews).values({
      businessId,
      previewUrl: PREVIEW,
      verdict: "changes",
      reviewedBy: "founder@example.com",
      notes: [note("1", "font"), note("2", "font", "sys-1"), note("3", "palette"), { id: "4", text: "old note", scope: "site", device: "phone", path: "/", anchor: null }] as never,
    });
    const tallies = await kindTallies();
    assert.deepEqual(tallies.font, { accepted: 0, rejected: 1, missed: 1 });
    assert.deepEqual(tallies.cohesion, { accepted: 0, rejected: 1, missed: 0 });
    assert.deepEqual(tallies.palette, { accepted: 0, rejected: 0, missed: 1 });
    assert.deepEqual(tallies.text, { accepted: 0, rejected: 0, missed: 0 });
  });
});

describe("a founder's own notes", () => {
  it("are classed other and section when there is no API key", async () => {
    assert.deepEqual(await classifyTexts(["a", "b"]), [
      { kind: "other", target: "section" },
      { kind: "other", target: "section" },
    ]);
  });

  it("keep the kind they already have and class only the ones without", async () => {
    const base = { text: "t", scope: "site" as const, device: "phone" as const, path: "/", anchor: null };
    const classed = await withClasses([
      { ...base, id: "typed" },
      { ...base, id: "spoken", kind: "font", target: "system" },
    ]);
    assert.deepEqual([classed[0].kind, classed[0].target], ["other", "section"]);
    assert.deepEqual([classed[1].kind, classed[1].target], ["font", "system"]);
  });

  it("come back from the spoken-note splitter with a kind and a target", async () => {
    const [split] = await splitSpokenNotes("make the heading bigger");
    assert.deepEqual([split.kind, split.target], ["other", "section"]);
  });
});
