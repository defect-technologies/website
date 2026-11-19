import assert from "node:assert/strict";
import { test } from "node:test";
import { boardLessonsMarkdown, boardPreferences, describeOption, isRedrawn, pageTone, pickAgreement, redrawnMark, REPLACED, revisedLetter, revisingMark, verdictOf, type BoardDecision, type BoardLetter, type BoardOption } from "./boards";

const LIGHT = { background: "#faf3e3", accent: "#b23c17" };
const DARK = { background: "#101a33", accent: "#f08d3c" };

function option(letter: BoardLetter, layout: string, extra: Partial<BoardOption> = {}): BoardOption {
  return {
    letter,
    boldness: letter === "a" ? 1 : letter === "b" ? 2 : 3,
    name: `Direction ${letter}`,
    idea: "An idea.",
    palette: LIGHT,
    fonts: { heading: "Zilla Slab", body: "DM Sans" },
    layout,
    controls: { shape: "square", fill: "solid", case: "sentence", weight: "bold", link: "underline" },
    motif: { name: "Sunburst", from: "Their logo." },
    headline: "Heating and cooling",
    line: "Family run.",
    photoTreatment: "plain",
    texture: "none",
    explores: letter === "c",
    pictures: { board: "https://x/a.jpg", desktop: "https://x/a-desktop.jpg", phone: "https://x/a-phone.jpg" },
    ...extra,
  };
}

function decision(chosen: BoardLetter, layouts: [string, string, string], extra: Partial<BoardDecision> = {}): BoardDecision {
  return { business: "Acme Heating", options: [option("a", layouts[0]), option("b", layouts[1]), option("c", layouts[2])], verdict: "chose", letter: chosen, feedback: "", by: "Brendan", role: "founder", pick: null, ...extra };
}

test("a layout nobody has been shown leans the draw neither way", () => {
  assert.deepEqual(boardPreferences([]), { layouts: {}, headings: {} });
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

test("the lessons carry each founder's choices apart, with what was passed over and their own words, then their counts", () => {
  assert.equal(boardLessonsMarkdown([]), "");
  const markdown = boardLessonsMarkdown([
    decision("b", ["split-hero", "type-led", "editorial"], { business: "JW Heating & Air", by: "Boris", feedback: "  No capitals\non buttons.  " }),
    decision("a", ["split-hero", "grid-or-collage", "editorial"]),
    decision("c", ["split-hero", "type-led", "editorial"], { business: "Old Plumbing", by: "Boris" }),
  ]);
  assert.match(markdown, /^# What the founders decided before/);
  assert.match(markdown, /Where they differ, don't average them/);
  const boris = markdown.slice(markdown.indexOf("## Boris"), markdown.indexOf("## Brendan"));
  const brendan = markdown.slice(markdown.indexOf("## Brendan"));
  assert.ok(markdown.indexOf("## Boris") < markdown.indexOf("## Brendan"), "the founder who decided most recently comes first");
  assert.match(boris, /### JW Heating & Air\n\n- Chose B, "Direction b":/);
  assert.match(boris, /### Old Plumbing/);
  assert.match(boris, /- Said: No capitals on buttons\./);
  assert.match(boris, /- First screens, chosen of shown: type-led 1 of 2; editorial 1 of 2; split-hero 0 of 2\./);
  assert.match(brendan, /### Acme Heating\n\n- Chose A, /);
  assert.ok(!brendan.includes("Old Plumbing"), "each founder's section holds only their own decisions");
  assert.match(brendan, /- Pages, chosen of shown: light 1 of 3\./);
  assert.equal(markdown.match(/- Passed over /g)?.length, 6);
});

test("a revision and three turned down teach the founder's taste, but count as no choice", () => {
  const revise = decision("c", ["split-hero", "type-led", "editorial"], { verdict: "revise", feedback: "Fonts too basic." });
  const none = decision("b", ["split-hero", "type-led", "editorial"], { verdict: "redraw", business: "Cypher Tattoo", feedback: "B feels the most sophisticated, but its serif is too plain." });
  const markdown = boardLessonsMarkdown([none, revise]);
  assert.match(markdown, /- Wanted none of the three and asked for three new designs:\n  - A, /);
  assert.match(markdown, /- Had B selected while writing, so words naming no option are about it\./);
  assert.match(markdown, /- Said: B feels the most sophisticated, but its serif is too plain\./);
  assert.match(markdown, /- Liked C, "Direction c":.* Asked for it to be revised/);
  assert.ok(!markdown.includes("Counts over every design"), "nothing was built, so there is nothing to count");
  assert.deepEqual(boardPreferences([none, revise]), { layouts: {}, headings: {} });
  assert.deepEqual(pickAgreement([{ ...revise, pick: { letter: "c", reason: "" } }]), { matched: 0, of: 0 });
});

test("a decision is read back from how the board records it, and Redraw all teaches nothing", () => {
  assert.deepEqual(verdictOf("b"), { verdict: "chose", letter: "b" });
  assert.deepEqual(verdictOf(revisingMark("c")), { verdict: "revise", letter: "c" });
  assert.deepEqual(verdictOf(redrawnMark("a")), { verdict: "redraw", letter: "a" });
  assert.deepEqual(verdictOf(redrawnMark(null)), { verdict: "redraw", letter: null });
  assert.equal(verdictOf(REPLACED), null);
  assert.equal(verdictOf(null), null);
  assert.equal(verdictOf("revise:x"), null);
  assert.equal(isRedrawn(REPLACED), true);
  assert.equal(isRedrawn("redrawn:b"), true);
  assert.equal(isRedrawn("revise:b"), false);
  assert.equal(revisedLetter("revise:b"), "b");
});

test("agreement counts only boards the system made a pick for", () => {
  assert.deepEqual(pickAgreement([decision("a", ["split-hero", "type-led", "editorial"])]), { matched: 0, of: 0 });
  const picked = (pick: BoardLetter, chosen: BoardLetter) => decision(chosen, ["split-hero", "type-led", "editorial"], { pick: { letter: pick, reason: "" } });
  assert.deepEqual(pickAgreement([picked("a", "a"), picked("b", "a"), picked("c", "c"), decision("a", ["split-hero", "type-led", "editorial"])]), { matched: 2, of: 3 });
});

test("recent compositions are listed for the next composer, and boards without one add nothing", async () => {
  const { recentCompositionsMarkdown } = await import("./boards");
  assert.equal(recentCompositionsMarkdown([{ business: "Old Plumbing", options: [{ letter: "a" }] }]), "");
  const markdown = recentCompositionsMarkdown([{ business: "Cypher Tattoo", options: [{ letter: "c", composition: "The yellow sign fills the screen." }, { letter: "a" }] }]);
  assert.match(markdown, /Don't repeat any of these/);
  assert.ok(markdown.includes("- Cypher Tattoo, C: The yellow sign fills the screen."));
  assert.ok(!markdown.includes("Cypher Tattoo, A"));
});

test("the heading faces the founders choose lean the next draw's type the same way", () => {
  const faces = (a: string, b: string, c: string) => [option("a", "split-hero", { fonts: { heading: a, body: "DM Sans" } }), option("b", "type-led", { fonts: { heading: b, body: "DM Sans" } }), option("c", "editorial", { fonts: { heading: c, body: "DM Sans" } })];
  const decisions = [1, 2, 3].map(() => ({ ...decision("c", ["split-hero", "type-led", "editorial"]), options: faces("Source Serif 4", "Tinos", "Pirata One") }));
  const { headings } = boardPreferences(decisions);
  assert.ok(headings["Pirata One"] > 1.5 && headings["Source Serif 4"] < 0.7);
});

test("a designer's choice leans the draw a third as far as a founder's", () => {
  const layouts = ["split-hero", "type-led", "editorial"] as [string, string, string];
  const founder = boardPreferences([decision("a", layouts)]).layouts["split-hero"];
  const designer = boardPreferences([decision("a", layouts, { by: "Maya", role: "designer" })]).layouts["split-hero"];
  assert.ok(designer > 1 && designer < founder, `a designer's ${designer} leans less than a founder's ${founder}`);
  const threeDesigners = boardPreferences([1, 2, 3].map(() => decision("a", layouts, { by: "Maya", role: "designer" }))).layouts["split-hero"];
  assert.equal(threeDesigners, founder, "three designers' choices weigh one founder's");
  const disagree = boardPreferences([decision("a", layouts), decision("b", layouts, { by: "Maya", role: "designer" })]).layouts;
  assert.ok(disagree["split-hero"] > disagree["type-led"], "where a founder and a designer disagree, the founder's choice leans further");
});

test("the lessons put the founders' decisions first and the designers' after, fewer and outranked", () => {
  const layouts = ["split-hero", "type-led", "editorial"] as [string, string, string];
  const designerDecisions = Array.from({ length: 12 }, (_, index) => decision("c", layouts, { business: `Shop ${index}`, by: "Maya", role: "designer", feedback: "Bolder type." }));
  const markdown = boardLessonsMarkdown([...designerDecisions, decision("a", layouts, { business: "Acme Heating", by: "Boris" })]);
  const designers = markdown.indexOf("# What the designers decided before");
  assert.ok(markdown.indexOf("## Boris") < designers && designers < markdown.indexOf("## Maya"), "founders first, even when a designer decided more recently");
  assert.match(markdown, /a founder's taste outranks a designer's/);
  assert.equal(markdown.match(/### Shop /g)?.length, 8, "a designer's section shows fewer of their decisions");
  assert.equal(boardLessonsMarkdown([decision("a", layouts)]).includes("designers decided"), false, "no designer section when no designer decided");
});
