/**
 * Repairs: the notes the runner is handed, the pictures it sends back, and what the Review page reads of them.
 *
 *   npm test
 *
 * Runs against an in-memory Postgres (PGlite) migrated from drizzle/.
 */
import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import type { ReviewNote } from "@/lib/review";
import { startEmptyTestDatabase } from "../emptyTestDatabase";

mock.module("server-only", { namedExports: {} });
process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";
// The store's ID is the third part of the token, and its files are served from <id>.public.blob.vercel-storage.com.
process.env.BRAND_FILES_READ_WRITE_TOKEN = "vercel_blob_rw_TestStore_secret";
const STORE = "https://teststore.public.blob.vercel-storage.com";

const closeDatabase = await startEmptyTestDatabase();
after(closeDatabase);

const { db } = await import("../db/client");
const { businesses, previewJobs, previewReviews } = await import("../db/schema");
const { eq } = await import("drizzle-orm");
const { isRepairPicture, isRepairPictureName } = await import("../boards/pictures");
const { claimNext, reportDone } = await import("./api");
const { requestPreview } = await import("./jobs");
const { repairChecks, repairChecksForPreview, repairNotesFor, uploadRepairPicture } = await import("./repairs");
const database = await db();

const OLD = "https://acme-1.vercel.app";
const NEW = "https://acme-2.vercel.app";
const NOTES: ReviewNote[] = [
  { id: "n1", text: "Too much text.", scope: "site", device: "phone", path: "/", anchor: { path: "/", selector: "main h2", tag: "h2", text: "About us" }, kind: "text", target: "section" },
  { id: "n2", text: "Heavier headings.", scope: "every", device: "desktop", path: "/services", anchor: null },
];

let made = 0;
async function reviewedLead(name: string) {
  made += 1;
  const [lead] = await database.insert(businesses).values({ businessName: name, slug: `repair-${made}`, linkCode: `repair-${made}`, website: `https://repair-${made}.example`, previewUrl: OLD, stage: "preview_built" } as never).returning();
  const { job } = await requestPreview(lead, "one@example.com", "1. On / at phone width: Too much text.");
  await database.insert(previewReviews).values({ businessId: lead.id, previewUrl: OLD, verdict: "changes", notes: NOTES, jobId: job.id, reviewedBy: "one@example.com" });
  return { lead, job };
}

const picture = (leadId: string, name: string) => `${STORE}/repairs/${leadId}/job/${name}-x1.jpg`;

test("a repair picture counts only when it is in our store, in the lead's repairs folder, under a note's number", () => {
  assert.ok(isRepairPicture(`${STORE}/repairs/lead-1/job/1-before.jpg`, "lead-1"));
  assert.ok(!isRepairPicture(`${STORE}/repairs/lead-2/job/1-before.jpg`, "lead-1"), "another lead's folder");
  assert.ok(!isRepairPicture(`${STORE}/boards/lead-1/job/a-board.jpg`, "lead-1"), "a board is not a repair picture");
  assert.ok(!isRepairPicture("https://evil.example/repairs/lead-1/1-before.jpg", "lead-1"), "another host");
  for (const name of ["1-before", "1-after", "40-after"]) assert.ok(isRepairPictureName(name), name);
  for (const name of ["0-before", "1-during", "a-before", "123-after", "1-before.jpg", "../1-before"]) assert.ok(!isRepairPictureName(name), name);
});

test("the runner is handed the founder's notes with a repair, and nothing it does not need", async () => {
  const { lead, job } = await reviewedLead("Acme Roofing");
  const claim = (await claimNext({ name: "runner-1" } as never, new Request("https://admin.example/api/runner/next?runner=runner-repairs"))) as { job: { id: string }; repair?: boolean; repairNotes?: unknown };
  assert.equal(claim.job.id, job.id);
  assert.equal(claim.repair, true);
  assert.deepEqual(claim.repairNotes, {
    previewUrl: OLD,
    notes: [
      { id: "n1", text: "Too much text.", device: "phone", path: "/", anchor: { path: "/", selector: "main h2", tag: "h2", text: "About us" } },
      { id: "n2", text: "Heavier headings.", device: "desktop", path: "/services", anchor: null },
    ],
  });
  assert.equal(await repairNotesFor(lead.id, "https://never-reviewed.vercel.app"), null);
  assert.equal(await repairNotesFor(lead.id, ""), null);

  await assert.rejects(() => uploadRepairPicture(job.id, "1-during", new Request("https://admin.example", { method: "PUT", body: "x" })), /not a repair picture/);
  await assert.rejects(() => uploadRepairPicture(job.id, "1-before", new Request("https://admin.example", { method: "PUT" })), /4 MB at most/);
  await assert.rejects(() => uploadRepairPicture("00000000-0000-0000-0000-000000000000", "1-before", new Request("https://admin.example", { method: "PUT", body: "x" })), /No preview job/);

  const reported = [
    { id: "n1", before: picture(lead.id, "1-before"), after: picture(lead.id, "1-after"), focus: 0.38 },
    { id: "n2", before: picture(lead.id, "2-before") },
    { id: "n9", after: picture(lead.id, "9-after") },
  ];
  await reportDone(job.id, { status: "done", previewUrl: NEW, repairs: reported });

  const checks = await repairChecksForPreview(lead.id, NEW);
  assert.deepEqual(checks, [{ id: "n1", text: "Too much text.", device: "phone", path: "/", anchor: { path: "/", selector: "main h2", tag: "h2", text: "About us" }, before: picture(lead.id, "1-before"), after: picture(lead.id, "1-after"), focus: 0.38 }], "a note with no picture of the new preview has nothing to answer it from");
  assert.deepEqual(await repairChecksForPreview(lead.id, OLD), [], "the first build was not a repair");
  const [stored] = await database.select().from(previewJobs).where(eq(previewJobs.id, job.id));
  assert.equal(stored.status, "done");
});

test("only pictures the lead's own job stored are shown", () => {
  const notes = { previewUrl: OLD, notes: NOTES.map(({ id, text, device, path, anchor }) => ({ id, text, device, path, anchor })) };
  const checks = repairChecks("lead-1", notes, [
    { id: "n1", before: "https://evil.example/1-before.jpg", after: `${STORE}/repairs/lead-1/job/1-after.jpg` },
    { id: "n2", before: `${STORE}/repairs/lead-1/job/2-before.jpg`, after: `${STORE}/repairs/lead-2/job/2-after.jpg` },
  ]);
  assert.deepEqual(checks.map((check) => [check.id, check.before, check.after]), [["n1", "", `${STORE}/repairs/lead-1/job/1-after.jpg`]]);
  assert.deepEqual(repairChecks("lead-1", null, [{ id: "n1", after: `${STORE}/repairs/lead-1/job/1-after.jpg` }]), [], "no founder's notes, nothing to check");
  assert.deepEqual(repairChecks("lead-1", notes, undefined), []);
});

test("a repaired preview asks the founder about each repaired note, in their own words", async () => {
  const { reviewQuestionsFor } = await import("../review/askWriter");
  const { noteFromRepair } = await import("@/components/admin/review/reviewDraft");
  const { lead, job } = await reviewedLead("Asked Dental");
  await database.update(previewJobs).set({ status: "running" }).where(eq(previewJobs.id, job.id));
  await reportDone(job.id, { status: "done", previewUrl: NEW, repairs: [{ id: "n1", before: picture(lead.id, "1-before"), after: picture(lead.id, "1-after") }] });

  const asks = await reviewQuestionsFor(lead.id, "Asked Dental", NEW);
  assert.deepEqual(asks, [
    { id: "repair:n1", topic: "layout", question: "Too much text.", path: "/", selector: "main h2", quote: "About us", repair: { before: picture(lead.id, "1-before"), after: picture(lead.id, "1-after"), device: "phone", tag: "h2" } },
  ]);

  const back = noteFromRepair(asks[0])!;
  assert.equal(back.text, "Still wrong after the repair: Too much text.");
  assert.deepEqual([back.scope, back.device, back.path], ["site", "phone", "/"]);
  assert.deepEqual(back.anchor, { path: "/", selector: "main h2", tag: "h2", text: "About us" }, "the same element, so the next repair finds it");
  assert.equal(noteFromRepair({ ...asks[0], repair: undefined }), null);
});
