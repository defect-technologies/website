export type Typeface = "display" | "script";
export type Speaker = "studio" | "you";

/** Shared by the site and by the script that bakes the paintings, so both set the text identically. */
export const TYPEFACES: Record<Typeface, { family: string; weight: number; lineHeight: number }> = {
  display: { family: "Big Shoulders", weight: 900, lineHeight: 0.92 },
  script: { family: "Dr Sugiyama", weight: 400, lineHeight: 1.25 },
};

export type Headline = {
  id: string;
  lines: string[];
  typeface: Typeface;
  ink: string;
  seed: number;
  /** Colours for a band of knife strokes around the words. Only the wordmark has one; everything else is just its letters. */
  band?: string[];
};

/** How far a painting overhangs its text, in ems: a band reaches well past it, bare letters only by their ragged edges. */
export function paintReach(headline: Headline) {
  return headline.band ? { x: 0.45, y: 0.5 } : { x: 0.08, y: 0.1 };
}

const INK = "#17161a";
const VERMILION = "#e2421b";

const EMBER = ["#e2421b", "#f28a2e", "#f4c26b", "#8a8580", "#2d2a32"];

/** What a visitor's own knife strokes are loaded with. */
export const BRUSH_PAINTS = ["#e2421b", "#f28a2e", "#f4c26b", "#3d5a80", "#98a6b8"];

export const WORDMARK: Headline = {
  id: "wordmark",
  lines: ["defect.tech"],
  typeface: "script",
  ink: INK,
  seed: 5,
  band: EMBER,
};

export type ConversationLine = Headline & { speaker: Speaker; scale: number };

function studioSays(id: string, text: string, scale: number, seed: number): ConversationLine {
  return { id, lines: [text], typeface: "display", ink: INK, seed, speaker: "studio", scale };
}

function youSay(id: string, text: string, scale: number, seed: number): ConversationLine {
  return { id, lines: [text], typeface: "display", ink: VERMILION, seed, speaker: "you", scale };
}

export const CONVERSATION: ConversationLine[] = [
  studioSays("what-do-you-want", "what do you want?", 1, 11),
  youSay("something-beautiful", "something beautiful?", 0.96, 23),
  studioSays("oh", "oh.", 1.25, 37),
  youSay("oh-question", "oh?", 1.25, 41),
  studioSays("in-my-sleep", "I make that in my sleep.", 1, 53),
];

export const WEBSITES: Headline = {
  id: "we-make-websites",
  lines: ["we make", "websites."],
  typeface: "display",
  ink: INK,
  seed: 61,
};

export const SAVINGS: Headline = {
  id: "we-save-money",
  lines: ["we save small", "businesses money."],
  typeface: "display",
  ink: INK,
  seed: 67,
};

export const CLOSING: Headline = {
  id: "good-technology",
  lines: ["we make good technology", "for good people"],
  typeface: "display",
  ink: INK,
  seed: 71,
};

export const TEAM_TITLE: Headline = {
  id: "two-of-us",
  lines: ["the two of us"],
  typeface: "display",
  ink: INK,
  seed: 79,
};

export const TEAM_NAMES: Record<"boris" | "brendan", Headline> = {
  boris: { id: "name-boris", lines: ["Boris Nezlobin"], typeface: "display", ink: INK, seed: 83 },
  brendan: { id: "name-brendan", lines: ["Brendan Giang"], typeface: "display", ink: INK, seed: 89 },
};

export const ALL_HEADLINES: Headline[] = [
  WORDMARK,
  ...CONVERSATION,
  WEBSITES,
  SAVINGS,
  CLOSING,
  TEAM_TITLE,
  ...Object.values(TEAM_NAMES),
];

export const SPEAKER_LABEL: Record<Speaker, string> = {
  studio: "defect.tech",
  you: "You",
};
