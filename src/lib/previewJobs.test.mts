import assert from "node:assert/strict";
import { test } from "node:test";
import { asksForNewDesign, changesBuiltPreview, founderNote, RETRY_NOTE } from "./previewJobs";

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
