import assert from "node:assert/strict";
import { test } from "node:test";
import { boardLessonsMarkdown, boardPreferences, describeOption, pageTone, pickAgreement, type BoardDecision, type BoardLetter, type BoardOption } from "./boards";

const LIGHT = { background: "#faf3e3", accent: "#b23c17" };
const DARK = { background: "#101a33", accent: "#f08d3c" };

function option(letter: BoardLetter, layout: string, extra: Partial<BoardOption> = {}): BoardOption {
  return {
    letter,
    name: `Direction ${letter}`,
    idea: "An idea.",
    palette: LIGHT,
    fonts: { heading: "Zilla Slab", body: "DM Sans" },
    layout,
    controls: { shape: "square", fill: "solid", case: "sentence", weight: "bold", link: "underline" },
    motif: { name: "Sunburst", from: "Their logo." },
    headline: "Heating and cooling",
    line: "Family run.",
    explores: letter === "c",
    pictures: { board: "https://x/a.jpg", desktop: "https://x/a-desktop.jpg", phone: "https://x/a-phone.jpg" },
    ...extra,
  };
}

function decision(chosen: BoardLetter, layouts: [string, string, string], extra: Partial<BoardDecision> = {}): BoardDecision {
  return { business: "Acme Heating", options: [option("a", layouts[0]), option("b", layouts[1]), option("c", layouts[2])], chosen, feedback: "", by: "Brendan", pick: null, ...extra };
}

test("a layout nobody has been shown leans the draw neither way", () => {
  assert.deepEqual(boardPreferences([]), { layouts: {} });
});

test("a layout the founders keep choosing is drawn more, and one they keep passing over less", () => {
  const decisions = [1, 2, 3, 4].map(() => decision("a", ["split-hero", "type-led", "editorial"]));
  const { layouts } = boardPreferences(decisions);
  assert.ok(layouts["split-hero"] > 1.8, `chosen 4 of 4 leans well above 1, got ${layouts["split-hero"]}`);
  assert.ok(layouts["type-led"] < 0.5 && layouts["type-led"] > 0, "passed over 4 of 4 leans below 1 and never reaches 0");
  assert.deepEqual(Object.keys(layouts), ["editorial", "split-hero", "type-led"]);
});

test("one early choice does not swing the draw", () => {
  const { layouts } = boardPreferences([decision("b", ["split-hero", "type-led", "editorial"])]);
  assert.ok(layouts["type-led"] > 1 && layouts["type-led"] <= 1.5);
  assert.ok(layouts["split-hero"] < 1 && layouts["split-hero"] >= 0.7);
});

test("a page is light or dark by its background", () => {
  assert.equal(pageTone(option("a", "split-hero")), "light");
  assert.equal(pageTone(option("a", "split-hero", { palette: DARK })), "dark");
});

test("an option is described in one line of plain words", () => {
  const caps = option("a", "centered-stack", { name: "Night call", palette: DARK, controls: { shape: "pill", fill: "outline", case: "caps", weight: null, link: "highlight" } });
  assert.equal(describeOption(caps), '"Night call": a dark page (#101a33) with #f08d3c as the brand colour; headings in Zilla Slab, text in DM Sans; a centered-stack first screen; pill outline buttons in capitals; motif: Sunburst.');
});

test("the lessons carry each choice, what was passed over and the founder's own words, then the counts", () => {
  assert.equal(boardLessonsMarkdown([]), "");
  const markdown = boardLessonsMarkdown([
    decision("b", ["split-hero", "type-led", "editorial"], { business: "JW Heating & Air", by: "Boris", feedback: "  No capitals\non buttons.  " }),
    decision("a", ["split-hero", "grid-or-collage", "editorial"]),
  ]);
  assert.match(markdown, /^# What the founders chose before/);
  assert.match(markdown, /## JW Heating & Air \(chosen by Boris\)\n\n- Chose "Direction b":/);
  assert.equal(markdown.match(/- Passed over /g)?.length, 4);
  assert.match(markdown, /- Said: No capitals on buttons\./);
  assert.match(markdown, /- First screens, chosen of shown: type-led 1 of 1; split-hero 1 of 2; /);
  assert.match(markdown, /- Pages, chosen of shown: light 2 of 6\./);
});

test("agreement counts only boards the system made a pick for", () => {
  assert.deepEqual(pickAgreement([decision("a", ["split-hero", "type-led", "editorial"])]), { matched: 0, of: 0 });
  const picked = (pick: BoardLetter, chosen: BoardLetter) => decision(chosen, ["split-hero", "type-led", "editorial"], { pick: { letter: pick, reason: "" } });
  assert.deepEqual(pickAgreement([picked("a", "a"), picked("b", "a"), picked("c", "c"), decision("a", ["split-hero", "type-led", "editorial"])]), { matched: 2, of: 3 });
});
