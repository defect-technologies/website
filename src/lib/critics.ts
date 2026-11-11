export const CRITIC_KINDS = ["sense", "text", "form", "spacing", "font", "palette", "cohesion", "other"] as const;
export type CriticKind = (typeof CRITIC_KINDS)[number];

export const CRITIC_TARGETS = ["system", "seam", "section"] as const;
export type CriticTarget = (typeof CRITIC_TARGETS)[number];

export const CRITIC_DEVICES = ["phone", "tablet", "desktop"] as const;
export type CriticDevice = (typeof CRITIC_DEVICES)[number];

export const CRITIC_STATUSES = ["applied", "open", "proposed"] as const;
export type CriticStatus = (typeof CRITIC_STATUSES)[number];

export const MAX_CRITIC_NOTES = 80;
export const MAX_CRITIC_TEXT = 600;
export const MAX_CRITIC_QUOTE = 80;
export const MAX_CRITIC_FIELD = 500;

/** One note a critic wrote about a built preview, as the pipeline's design/critic-notes.json lists it. */
export type CriticNote = {
  id: string;
  target: CriticTarget;
  kind: CriticKind;
  path: string;
  device: CriticDevice;
  selector: string;
  quote: string;
  text: string;
  source: string;
  model: string;
  status: CriticStatus;
};

export type CriticSettings = {
  enabled: boolean;
  minutes: number;
  apply: CriticKind[];
  maxNotes: number;
  secondBuilder: boolean;
};

export const DEFAULT_CRITIC_SETTINGS: CriticSettings = { enabled: false, minutes: 20, apply: [], maxNotes: 24, secondBuilder: false };

export const MIN_CRITIC_MINUTES = 2;
export const MAX_CRITIC_MINUTES = 90;

export const KIND_LABEL: Record<CriticKind, string> = {
  sense: "Presentation makes no sense",
  text: "Too much text",
  form: "Needs a more visual form",
  spacing: "Spacing and overlap",
  font: "Font",
  palette: "Colors hard to look at",
  cohesion: "Sections do not fit together",
  other: "Other",
};

export const TARGET_SENTENCE: Record<CriticTarget, string> = {
  system:
    "This is a system note: change the shared styles (type styles, colour roles, frame style, image treatment, motif, backgrounds) so the fix applies to every section of the site, not only the one it points at.",
  seam: "This is a seam note: repair the boundary between the section it points at and the section below it.",
  section: "This is a section note: change only the section it points at, and use only styles the site's system already has. Do not add colours, type styles or one-off values.",
};

const MAX_PROPOSAL_WORDS = 8;

const wordsOf = (text: string) => text.split(" ").filter(Boolean);

/** The first clause that fits the limit, so the words still make sense when cut. Null when no clause fits. */
function leadingClause(sentence: string): string | null {
  const [clause] = sentence.split(/[,;:]\s/);
  const words = wordsOf(clause);
  return words.length >= 3 && words.length <= MAX_PROPOSAL_WORDS ? clause : null;
}

/** A proposal as a few plain words: its first sentence, or the first clause of it when the sentence is long. */
export function proposalWords(text: string): string {
  const sentence = (text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] ?? "").replace(/[.!?]$/, "");
  const words = wordsOf(sentence);
  if (words.length <= MAX_PROPOSAL_WORDS) return sentence;
  return leadingClause(sentence) ?? `${words.slice(0, MAX_PROPOSAL_WORDS).join(" ")}...`;
}

/** The notes a founder is asked about: the ones the pipeline left open or only proposed, system notes first. */
const TARGET_ORDER: Record<CriticTarget, number> = { system: 0, seam: 1, section: 2 };

export function proposalsFrom(notes: CriticNote[], answeredIds: ReadonlySet<string>): CriticNote[] {
  return notes
    .filter((note) => note.status !== "applied" && !answeredIds.has(note.id))
    .toSorted((a, b) => TARGET_ORDER[a.target] - TARGET_ORDER[b.target]);
}

export function hasProposals(notes: CriticNote[] | null | undefined): boolean {
  return Boolean(notes?.some((note) => note.status !== "applied"));
}

export type KindTally = { accepted: number; rejected: number; missed: number };

export const TRUST_MIN_ANSWERS = 10;
export const TRUST_MIN_SHARE = 0.9;

export function acceptedShare(tally: KindTally): number | null {
  const answered = tally.accepted + tally.rejected;
  return answered ? tally.accepted / answered : null;
}

/** A kind has earned trust once enough proposals were answered and the founder accepted nearly all of them. */
export function hasEarnedTrust(tally: KindTally): boolean {
  const share = acceptedShare(tally);
  return share !== null && tally.accepted + tally.rejected >= TRUST_MIN_ANSWERS && share >= TRUST_MIN_SHARE;
}

export function emptyTallies(): Record<CriticKind, KindTally> {
  return Object.fromEntries(CRITIC_KINDS.map((kind) => [kind, { accepted: 0, rejected: 0, missed: 0 }])) as Record<CriticKind, KindTally>;
}

const isKind = (value: unknown): value is CriticKind => CRITIC_KINDS.includes(value as CriticKind);

/** Counts per kind from the founder's answers and from the notes he wrote himself that no proposal led to. */
export function tallyKinds(answers: { kind: string; accepted: boolean }[], writtenNotes: { kind?: string; proposalId?: string }[]): Record<CriticKind, KindTally> {
  const tallies = emptyTallies();
  for (const answer of answers) {
    if (isKind(answer.kind)) tallies[answer.kind][answer.accepted ? "accepted" : "rejected"] += 1;
  }
  for (const note of writtenNotes) {
    if (isKind(note.kind) && !note.proposalId) tallies[note.kind].missed += 1;
  }
  return tallies;
}
