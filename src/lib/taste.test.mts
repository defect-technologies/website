import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_REBUILD_NOTE, rebuildNote, type TasteNote } from "./taste";

const note = (text: string, scope: TasteNote["scope"] = "site"): TasteNote => ({ scope, category: "type", text });

test("a rebuild note lists only this site's notes", () => {
  const written = rebuildNote([note("Make the headline heavier"), note("Never use pill buttons", "all")]);
  assert.match(written, /- Type: Make the headline heavier/);
  assert.doesNotMatch(written, /pill buttons/);
});

test("a review with only rules for every site makes no rebuild note", () => {
  assert.equal(rebuildNote([note("Never use pill buttons", "all")]), "");
});

test("a rebuild note drops whole notes rather than cutting one off", () => {
  const notes = Array.from({ length: 10 }, (_, index) => note(`${index} ${"x".repeat(500)}`));
  const written = rebuildNote(notes);
  assert.ok(written.length <= MAX_REBUILD_NOTE);
  assert.ok(written.split("\n").slice(1).every((line) => line.endsWith("x")));
});
