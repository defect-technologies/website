import assert from "node:assert/strict";
import { test } from "node:test";
import { asksForNewDesign, changesBuiltPreview, founderNote, isRepair, RETRY_NOTE } from "./previewJobs";
import { POINTING_NOTE } from "./review";

const PREVIEW = "https://acme-1.vercel.app";

test("a founder's note is the job's note without the automatic retry's words", () => {
  assert.equal(founderNote(""), "");
  assert.equal(founderNote(RETRY_NOTE), "");
  assert.equal(founderNote(`The heading is too large.\n\n${RETRY_NOTE}`), "The heading is too large.");
});

test("only the line the pipeline reads asks for a new design", () => {
  assert.ok(asksForNewDesign("Start a new design."));
  assert.ok(asksForNewDesign("Make it bolder.\n  start a new design  \nUse their red."));
  assert.ok(!asksForNewDesign("Do not start a new design."));
  assert.ok(!asksForNewDesign(""));
});

test("a founder's note about a built preview changes that preview", () => {
  assert.ok(changesBuiltPreview("The heading is too large.", PREVIEW));
  assert.ok(changesBuiltPreview(`The heading is too large.\n\n${RETRY_NOTE}`, PREVIEW), "its retry is still the founder's change");
  assert.ok(!changesBuiltPreview("Their site is good, build it anyway.", ""), "no preview yet: a first build");
  assert.ok(!changesBuiltPreview("", PREVIEW), "no note: a new build");
  assert.ok(!changesBuiltPreview(RETRY_NOTE, PREVIEW), "an automatic retry of a new build");
  assert.ok(!changesBuiltPreview("Start a new design.\nMake it bolder.", PREVIEW));
});

test("a founder's note about a built preview is repaired, and another bot's request is built the long way", () => {
  const job = { kind: "preview", note: "The heading is too large.", requestedBy: "one@example.com" };
  assert.ok(isRepair(job, PREVIEW));
  assert.ok(isRepair({ ...job, note: `${job.note}\n\n${RETRY_NOTE}`, requestedBy: "bot:runner" }, PREVIEW), "the runner's retry of a repair");
  assert.ok(!isRepair({ ...job, requestedBy: "bot:outreach" }, PREVIEW), "no founder wrote it, so the outside reviewer reads it");
  assert.ok(!isRepair(job, ""), "nothing is built yet");
  assert.ok(!isRepair({ ...job, note: "Start a new design." }, PREVIEW));
  assert.ok(!isRepair({ ...job, kind: "launch" }, PREVIEW));
  assert.ok(!isRepair({ ...job, note: POINTING_NOTE }, PREVIEW), "that update takes the newest kit, and a repair keeps the site's own");
});
