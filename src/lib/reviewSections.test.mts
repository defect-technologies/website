import assert from "node:assert/strict";
import { test } from "node:test";
import { CRITIC_KINDS } from "./critics";
import { QUICK_NOTES, quickNote, quickNoteOn, readSections, sectionAnchor, sectionInView } from "./reviewSections";

const SECTIONS = [
  { index: 1, selector: "main > section:nth-of-type(1)", heading: "Heating and cooling", top: 0 },
  { index: 2, selector: "main > section:nth-of-type(2)", heading: "What we cover", top: 900 },
  { index: 3, selector: "main > section:nth-of-type(3)", heading: "", top: 1800 },
];

test("the six one-tap notes are the founders' usual follow-ups, each a kind the builder knows", () => {
  assert.deepEqual(QUICK_NOTES.map((quick) => quick.kind), ["text", "form", "sense", "spacing", "font", "palette"]);
  for (const quick of QUICK_NOTES) assert.ok((CRITIC_KINDS as readonly string[]).includes(quick.kind) && quick.text.length > 20 && quick.label.length <= 16);
  assert.deepEqual(QUICK_NOTES.filter((quick) => quick.target === "system").map((quick) => quick.kind), ["font", "palette"], "a font or a palette is the whole site's");
});

test("a one-tap note is about its section, at the width the founder looks at, and is found again to take it off", () => {
  const note = quickNote(SECTIONS[1], "text", "phone", "/services", "id-1")!;
  assert.deepEqual(note, {
    id: "id-1",
    text: "Too much text. Cut it to what a visitor needs to decide.",
    scope: "site",
    device: "phone",
    path: "/services",
    anchor: { path: "/services", selector: "main > section:nth-of-type(2)", tag: "section", text: "What we cover" },
    kind: "text",
    target: "section",
  });
  assert.equal(quickNoteOn([note], SECTIONS[1], "text"), note);
  assert.equal(quickNoteOn([note], SECTIONS[1], "spacing"), undefined);
  assert.equal(quickNoteOn([note], SECTIONS[0], "text"), undefined, "the same note on another section is another note");
  assert.equal(quickNoteOn([{ ...note, text: "Too much text, and the photo is wrong." }], SECTIONS[1], "text"), undefined, "a note the founder wrote himself is not a tap to undo");
  assert.equal(quickNote(SECTIONS[1], "cohesion", "phone", "/", "id-2"), null);
  assert.deepEqual(sectionAnchor(SECTIONS[2], "/"), { path: "/", selector: "main > section:nth-of-type(3)", tag: "section", text: "" });
});

test("the steps begin at the section the founder is looking at", () => {
  assert.equal(sectionInView(SECTIONS, 0), 0);
  assert.equal(sectionInView(SECTIONS, 700), 0, "the second section is still below where they look");
  assert.equal(sectionInView(SECTIONS, 760), 1);
  assert.equal(sectionInView(SECTIONS, 5000), 2);
  assert.equal(sectionInView([], 300), 0);
});

test("only sections of the reported shape are stepped through", () => {
  const reported = [...SECTIONS, { index: "4", selector: "x", heading: "y", top: 1 }, null, { index: 5, selector: "main > div", heading: "h".repeat(300), top: 2700 }];
  const read = readSections(reported);
  assert.deepEqual(read.map((section) => section.index), [1, 2, 3, 5]);
  assert.equal(read[3].heading.length, 120);
  assert.deepEqual(readSections("sections"), []);
  assert.equal(readSections(Array.from({ length: 80 }, (_, at) => ({ index: at + 1, selector: "s", heading: "", top: at }))).length, 40);
});
