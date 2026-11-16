// Design boards: before a preview is built, the runner sends three options for its look, and a founder chooses one.
// This file is what the choices teach: how they lean the next draw, what the next option writer is told about them,
// and how often the system's own guess matched the founder. Storage is in src/server/boards.

export const BOARD_LETTERS = ["a", "b", "c"] as const;
export type BoardLetter = (typeof BOARD_LETTERS)[number];

/**
 * A founder wanted none of a board's three options and asked for three new ones. The board is decided with this in
 * place of a letter (design_boards.chosen_letter, so no migration): nothing is built from it, and the runner draws again.
 */
export const REDRAWN = "redrawn";

/**
 * A founder liked one option and asked for it to be revised with their words: the board is decided with "revise:c" in
 * place of a letter. Nothing is built from it, and the runner draws three revisions of that option.
 */
const REVISE_PREFIX = "revise:";

export const revisingMark = (letter: BoardLetter) => `${REVISE_PREFIX}${letter}`;

/** The option a decided board asked to have revised, if that is how it was decided. */
export function revisedLetter(chosenLetter: string | null): BoardLetter | null {
  const letter = chosenLetter?.startsWith(REVISE_PREFIX) ? chosenLetter.slice(REVISE_PREFIX.length) : "";
  return (BOARD_LETTERS as readonly string[]).includes(letter) ? (letter as BoardLetter) : null;
}

/**
 * What the runner is handed to draw a lead's boards again: the founder's words, and for a revision the letter of the
 * option to revise (`base`). Without a base it is three new designs.
 */
export interface BoardRedraw {
  feedback: string;
  by: string;
  base?: BoardLetter;
  /** The decided board this answers: the new boards record it, so a job cut off after drawing them doesn't draw them twice. */
  board: string;
}

/**
 * The pictures of one option: its whole board, its first screen on a desktop and on a phone, (from site-kit 0.15.0)
 * the board in one column at a phone's width, and (from site-kit 0.16.0) its whole home page on a desktop and on a
 * phone, composed for this business.
 */
export const BOARD_VIEWS = ["board", "desktop", "phone", "narrow", "page", "pagePhone"] as const;
export type BoardView = (typeof BOARD_VIEWS)[number];

/** Where an option's pictures are. Boards made before the narrow board or the whole page have none of those. */
export type BoardPictures = { board: string; desktop: string; phone: string; narrow?: string; page?: string; pagePhone?: string };

export interface BoardControls {
  shape: string | null;
  fill: string;
  case: string | null;
  weight: string | null;
  link: string;
}

/** One option as the runner sends it: the choices a build is held to, and where its pictures are. */
export interface BoardOption {
  letter: BoardLetter;
  /** How far the option goes from how the business looks today: 1 stays close, 3 goes furthest. */
  boldness: number;
  name: string;
  idea: string;
  palette: Record<string, string>;
  fonts: { heading: string; body: string };
  layout: string;
  controls: BoardControls;
  motif: { name: string; from: string };
  headline: string;
  line: string;
  photoTreatment: string;
  texture: string;
  /** Drawn without the founders' preferences, so the options never narrow to what was chosen before. */
  explores: boolean;
  /** How its home page is composed, in a sentence. Boards made before composed pages have none. */
  composition?: string;
  pictures: BoardPictures;
}

/** Which option the system expected the founders to choose, written before they saw the boards. */
export interface BoardPick {
  letter: BoardLetter;
  reason: string;
}

/** A board a founder has decided. */
export interface BoardDecision {
  business: string;
  options: BoardOption[];
  chosen: BoardLetter;
  feedback: string;
  by: string;
  pick: BoardPick | null;
}

/** How much more (above 1) or less (below 1) often site-kit draws a value. The kit keeps every value between a quarter and four times. */
export interface BoardPreferences {
  layouts: Record<string, number>;
  /** How the founders lean on each heading face they were shown. site-kit turns these into a lean on the faces' character. */
  headings: Record<string, number>;
}

/** Showings a value is assumed to have had with an average result, so one early choice doesn't swing the draw. */
const PRIOR_SHOWINGS = 3;
const CHANCE = 1 / BOARD_LETTERS.length;
/** A page counts as dark below this relative luminance. */
const DARK_PAGE = 0.35;
export const LESSON_SITES = 20;
export const AGREEMENT_SITES = 20;

interface Tally {
  shown: number;
  chosen: number;
}

function tally(decisions: BoardDecision[], valueOf: (option: BoardOption) => string): Map<string, Tally> {
  const counts = new Map<string, Tally>();
  for (const decision of decisions) {
    for (const option of decision.options) {
      const entry = counts.get(valueOf(option)) ?? { shown: 0, chosen: 0 };
      entry.shown += 1;
      if (option.letter === decision.chosen) entry.chosen += 1;
      counts.set(valueOf(option), entry);
    }
  }
  return counts;
}

/** Chosen as often as chance gives 1; twice as often gives about 2. A value never shown gives 1. */
function leaning({ shown, chosen }: Tally): number {
  const expected = (shown + PRIOR_SHOWINGS) * CHANCE;
  return Math.round(((chosen + PRIOR_SHOWINGS * CHANCE) / expected) * 100) / 100;
}

/** What the founders' choices so far tell the next draw. */
export function boardPreferences(decisions: BoardDecision[]): BoardPreferences {
  const leanings = (counts: Map<string, Tally>) => Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b)).map(([value, tallied]) => [value, leaning(tallied)]));
  return { layouts: leanings(tally(decisions, (option) => option.layout)), headings: leanings(tally(decisions, (option) => option.fonts.heading)) };
}

function luminance(colour: string): number {
  const hex = /^#?([0-9a-f]{6})$/i.exec(colour.trim())?.[1];
  if (!hex) return 1;
  const [red, green, blue] = [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255).map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function pageTone(option: BoardOption): "light" | "dark" {
  return luminance(option.palette.background ?? "#ffffff") < DARK_PAGE ? "dark" : "light";
}

function buttons(controls: BoardControls): string {
  const words = [controls.shape, controls.fill, "buttons"].filter(Boolean).join(" ");
  return controls.case === "caps" ? `${words} in capitals` : words;
}

/** An option in one line, in words a model and a founder both read. */
export function describeOption(option: BoardOption): string {
  const colours = `a ${pageTone(option)} page (${option.palette.background}) with ${option.palette.accent} as the brand colour`;
  const page = option.composition ? `a page composed as ${option.composition.replace(/\.$/, "")}` : `a ${option.layout} first screen`;
  return `"${option.name}": ${colours}; headings in ${option.fonts.heading}, text in ${option.fonts.body}; ${page}; ${buttons(option.controls)}; motif: ${option.motif.name}.`;
}

function decisionLines(decision: BoardDecision): string[] {
  const chosen = decision.options.find((option) => option.letter === decision.chosen);
  if (!chosen) return [];
  const passed = decision.options.filter((option) => option.letter !== decision.chosen).map((option) => `- Passed over ${describeOption(option)}`);
  const said = decision.feedback.trim() ? [`- Said: ${decision.feedback.replace(/\s+/g, " ").trim()}`] : [];
  return [`## ${decision.business} (chosen by ${decision.by})`, "", `- Chose ${describeOption(chosen)}`, ...passed, ...said, ""];
}

function tallyLine(label: string, counts: Map<string, Tally>): string {
  const parts = [...counts].sort(([, a], [, b]) => b.chosen / b.shown - a.chosen / a.shown).map(([value, { shown, chosen }]) => `${value} ${chosen} of ${shown}`);
  return `- ${label}, chosen of shown: ${parts.join("; ")}.`;
}

/**
 * What the next option writer reads (lead/board-lessons.md): the founders' most recent choices with their own words,
 * newest first, then the counts. Empty when nothing has been chosen yet.
 */
export function boardLessonsMarkdown(decisions: BoardDecision[]): string {
  if (!decisions.length) return "";
  const recent = decisions.slice(0, LESSON_SITES);
  const intro =
    "What the founders chose on earlier sites, newest first, and what they said. Learn their taste from it: lean toward what they choose and away from what they pass over, and never repeat something they said they don't want. Each business is different, so take the taste, not the design.";
  const counts = [
    tallyLine("How far the option goes (1 close to how the business looks today, 3 far from it)", tally(decisions, (option) => String(option.boldness))),
    tallyLine("Pages", tally(decisions, pageTone)),
    tallyLine("First screens", tally(decisions, (option) => option.layout)),
    tallyLine("Buttons", tally(decisions, (option) => buttons(option.controls))),
    tallyLine("Photos", tally(decisions, (option) => option.photoTreatment)),
  ];
  return ["# What the founders chose before", "", intro, "", ...recent.flatMap(decisionLines), "## Counts over every choice", "", ...counts, ""].join("\n");
}

/** How often the system's own pick was the option the founder chose, over the most recent boards that had a pick. */
export function pickAgreement(decisions: BoardDecision[]): { matched: number; of: number } {
  const withPick = decisions.filter((decision) => decision.pick).slice(0, AGREEMENT_SITES);
  return { matched: withPick.filter((decision) => decision.pick?.letter === decision.chosen).length, of: withPick.length };
}

/** How many of the newest boards' compositions the next composer is shown, so it doesn't repeat them. */
export const RECENT_COMPOSITION_BOARDS = 30;

/**
 * What the next page composer reads (lead/recent-compositions.md): how recent boards, for every business, composed
 * their pages. The founders saw the same few first screens on every business; this is what keeps a new one apart.
 */
export function recentCompositionsMarkdown(boards: { business: string; options: Pick<BoardOption, "letter" | "composition">[] }[]): string {
  const lines = boards.flatMap((board) => board.options.filter((option) => option.composition).map((option) => `- ${board.business}, ${option.letter.toUpperCase()}: ${option.composition}`));
  if (!lines.length) return "";
  return ["# How recent boards composed their pages", "", "Every business gets its own. Don't repeat any of these, and don't make one that would read as a variation of one:", "", ...lines, ""].join("\n");
}
