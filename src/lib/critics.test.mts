/**
 * The vocabulary of critic notes: the founder's numbers per kind, the words of a proposal, and how a note tells the
 * builder where its repair belongs.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { acceptedShare, type CriticNote, hasEarnedTrust, hasProposals, proposalsFrom, proposalWords, tallyKinds } from "./critics";
import { compileReviewNote, DEVICE_WIDTH, type ReviewNote } from "./review";
import { askAnchor, askFromProposal } from "./reviewAsks";

const note = (overrides: Partial<CriticNote>): CriticNote => ({
  id: "home-s03-text-1",
  target: "section",
  kind: "text",
  path: "/",
  device: "phone",
  selector: "main > section:nth-of-type(3)",
  quote: "We have served the neighbourhood since 1987",
  text: "Cut this section to two sentences. The rest repeats the home page.",
  source: "verify:density",
  model: "measured",
  status: "proposed",
  ...overrides,
});

describe("per-kind numbers", () => {
  it("counts accepted and rejected answers by kind", () => {
    const tallies = tallyKinds(
      [
        { kind: "text", accepted: true },
        { kind: "text", accepted: true },
        { kind: "text", accepted: false },
        { kind: "font", accepted: false },
      ],
      [],
    );
    assert.deepEqual(tallies.text, { accepted: 2, rejected: 1, missed: 0 });
    assert.deepEqual(tallies.font, { accepted: 0, rejected: 1, missed: 0 });
    assert.deepEqual(tallies.palette, { accepted: 0, rejected: 0, missed: 0 });
  });

  it("counts only notes the founder wrote himself as missed, and ignores notes with no kind", () => {
    const tallies = tallyKinds(
      [],
      [
        { kind: "spacing" },
        { kind: "spacing", proposalId: "home-s02-spacing-1" },
        { kind: "spacing" },
        {},
        { kind: "no-such-kind" },
      ],
    );
    assert.equal(tallies.spacing.missed, 2);
    assert.equal(Object.values(tallies).reduce((sum, tally) => sum + tally.missed, 0), 2);
  });

  it("gives a kind trust only after enough answers with nearly all accepted", () => {
    assert.equal(acceptedShare({ accepted: 0, rejected: 0, missed: 4 }), null);
    assert.equal(hasEarnedTrust({ accepted: 9, rejected: 0, missed: 0 }), false);
    assert.equal(hasEarnedTrust({ accepted: 9, rejected: 1, missed: 0 }), true);
    assert.equal(hasEarnedTrust({ accepted: 8, rejected: 2, missed: 0 }), false);
  });
});

describe("proposals", () => {
  it("asks only about open and proposed notes that are not answered yet, system notes first", () => {
    const notes = [
      note({ id: "a", target: "section" }),
      note({ id: "b", status: "applied" }),
      note({ id: "c", target: "system", status: "open" }),
      note({ id: "d", target: "seam" }),
      note({ id: "e" }),
    ];
    assert.deepEqual(
      proposalsFrom(notes, new Set(["e"])).map((each) => each.id),
      ["c", "d", "a"],
    );
  });

  it("knows when a job reported anything to ask about", () => {
    assert.equal(hasProposals(null), false);
    assert.equal(hasProposals([]), false);
    assert.equal(hasProposals([note({ status: "applied" })]), false);
    assert.equal(hasProposals([note({ status: "open" })]), true);
  });

  it("writes a proposal as its first sentence, cut to a few words", () => {
    assert.equal(proposalWords("Cut this section to two sentences. The rest repeats the home page."), "Cut this section to two sentences");
    assert.equal(proposalWords("Give every section the same heading position, so the page reads as one piece."), "Give every section the same heading position");
    assert.equal(proposalWords("Replace the three paragraphs of body copy under the hero with one short line"), "Replace the three paragraphs of body copy under...");
  });

  it("becomes a question that outlines the note's element and keeps the job it came from", () => {
    const ask = askFromProposal("job-1", note({}));
    assert.equal(ask.question, "Cut this section to two sentences");
    assert.equal(ask.proposal?.jobId, "job-1");
    assert.equal(ask.proposal?.id, "home-s03-text-1");
    assert.deepEqual(askAnchor(ask), { path: "/", selector: "main > section:nth-of-type(3)", tag: "", text: "We have served the neighbourhood since 1987" });
    assert.equal(askAnchor(askFromProposal("job-1", note({ target: "system", selector: "" }))), null);
  });
});

describe("telling the builder where a note belongs", () => {
  const base: ReviewNote = { id: "n", text: "Make the headings one style.", scope: "site", device: "tablet", path: "/", anchor: null };

  it("says a system note changes the shared styles and applies everywhere", () => {
    const text = compileReviewNote([{ ...base, target: "system" }], "https://x.vercel.app");
    assert.match(text, /At tablet width, 768 px|at tablet width, 768 px/);
    assert.match(text, /system note: change the shared styles .* every section/);
  });

  it("says a section note may use only styles the system already has", () => {
    const text = compileReviewNote([{ ...base, target: "section" }], "https://x.vercel.app");
    assert.match(text, /section note: change only the section it points at, and use only styles the site's system already has/);
  });

  it("leaves a note with no target as it was", () => {
    assert.doesNotMatch(compileReviewNote([base], "https://x.vercel.app"), /system note|section note|seam note/);
  });

  it("knows the tablet width", () => {
    assert.equal(DEVICE_WIDTH.tablet, 768);
  });
});
