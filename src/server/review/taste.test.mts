/**
 * Each founder's taste: their lessons, which only they edit, and every note they wrote, kept apart from the other's.
 *
 *   npm test
 *
 * Runs against an in-memory Postgres (PGlite) migrated from drizzle/.
 */
import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { startEmptyTestDatabase } from "../emptyTestDatabase";

mock.module("server-only", { namedExports: {} });
process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";

const closeDatabase = await startEmptyTestDatabase();
after(closeDatabase);
const { db } = await import("../db/client");
const { businesses, designBoards, previewJobs, previewReviews, spotChecks } = await import("../db/schema");
const taste = await import("./taste");
const { notesBy } = await import("./founderNotes");
const database = await db();

const BORIS = "boris.nezlobin@gmail.com";
const BRENDAN = "brendan@g.studio";

test("a founder's lesson is theirs: the other founder can neither edit, retire nor restore it", async () => {
  await taste.addTasteLessons(["No pills."], BORIS);
  await taste.addTasteLessons(["Serifs for trades."], BRENDAN);
  const [boris] = (await taste.activeTasteLessons()).filter((lesson) => lesson.createdBy === BORIS);

  await taste.updateTasteLesson(boris.id, "Pills everywhere.", BRENDAN);
  await taste.retireTasteLesson(boris.id, BRENDAN);
  assert.deepEqual((await taste.activeTasteLessons()).find((lesson) => lesson.id === boris.id)?.text, "No pills.");

  await taste.updateTasteLesson(boris.id, "Never a pill button.", BORIS);
  await taste.retireTasteLesson(boris.id, BORIS);
  assert.equal((await taste.retiredTasteLessons()).find((lesson) => lesson.id === boris.id)?.text, "Never a pill button.");
  await taste.restoreTasteLesson(boris.id, BRENDAN);
  assert.ok(!(await taste.activeTasteLessons()).some((lesson) => lesson.id === boris.id));
  await taste.restoreTasteLesson(boris.id, BORIS);
  assert.ok((await taste.activeTasteLessons()).some((lesson) => lesson.id === boris.id));

  const { markdown, lessons } = await taste.tasteForRunner();
  assert.match(markdown, /## Boris\n\n- Never a pill button\.\n\n## Brendan\n\n- Serifs for trades\./);
  assert.deepEqual(lessons.map((lesson) => lesson.createdBy).sort(), [BORIS, BRENDAN]);
});

test("every note a founder wrote is theirs to read back, and a Redraw all or another founder's note is not", async () => {
  const [lead] = await database.insert(businesses).values({ businessName: "Cypher Tattoo", slug: "taste-1", linkCode: "taste-1", website: "https://taste-1.example" } as never).returning();
  // A lead has one open job at a time, so the jobs behind its boards are finished ones.
  const [job, jobTwo, jobThree, jobFour] = await database.insert(previewJobs).values([1, 2, 3, 4].map(() => ({ businessId: lead.id, requestedBy: BORIS, status: "done" }) as never)).returning();
  const board = (chosenLetter: string, feedback: string, chosenBy: string, at: string) => ({ businessId: lead.id, jobId: job.id, options: [], chosenLetter, feedback, chosenBy, chosenAt: new Date(at) });
  await database.insert(designBoards).values([
    board("redrawn:b", "B feels the most sophisticated, but its serif is too plain.", BORIS, "2026-11-16T10:00:00Z"),
    { ...board("replaced", "", BORIS, "2026-11-16T11:00:00Z"), jobId: jobTwo.id },
    { ...board("a", "", BORIS, "2026-11-16T12:00:00Z"), jobId: jobThree.id },
    { ...board("revise:c", "Quieter orange.", BRENDAN, "2026-11-16T13:00:00Z"), jobId: jobFour.id },
  ]);
  const note = { id: "n1", text: "The heading is too small.", device: "phone" as const, path: "/", anchor: null };
  await database.insert(previewReviews).values({ businessId: lead.id, previewUrl: "https://cypher-1.vercel.app", verdict: "changes", notes: [note], reviewedBy: BORIS, reviewedAt: new Date("2026-11-16T14:00:00Z") });
  await database.insert(spotChecks).values({ businessId: lead.id, previewUrl: "https://cypher-0.vercel.app", status: "reviewed", note: "Copy is stiff.", reviewedBy: BRENDAN, reviewedAt: new Date("2026-11-16T15:00:00Z") } as never);

  const boris = await notesBy(BORIS);
  assert.deepEqual(
    boris.map((entry) => [entry.about, entry.text]),
    [
      ["Preview sent back", "The heading is too small."],
      ["Wanted none, with B selected", "B feels the most sophisticated, but its serif is too plain."],
    ],
    "newest first, and neither the replaced board nor a choice made without words is a note",
  );
  assert.equal(boris[1].href, `/admin/designs/${(await database.select().from(designBoards)).find((row) => row.chosenLetter === "redrawn:b")!.id}`);
  const brendan = await notesBy(BRENDAN);
  assert.deepEqual(
    brendan.map((entry) => entry.about),
    ["Spot check", "Asked for C revised"],
  );
});
