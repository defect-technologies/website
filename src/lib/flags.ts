/**
 * The shape of a flag a founder reads in the review queue: one plain headline, what it needs
 * from them, and everything else folded away as details.
 */
export const FLAG_NEEDS = ["decision", "fix", "nothing"] as const;
export type FlagNeeds = (typeof FLAG_NEEDS)[number];

export const FIXERS = ["either", "brendan", "boris", "claude"] as const;
export type Fixer = (typeof FIXERS)[number];

export const FIXER_LABEL: Record<Fixer, string> = { either: "Either of you", brendan: "Brendan", boris: "Boris", claude: "Claude" };

/** A flag on the same lead and topic as an open one joins it instead of opening a second card. */
export const FLAG_TOPICS = ["launch", "build", "preview-review", "client-waiting", "domain", "site-change", "billing", "email-quality", "feature-request", "other"] as const;
export type FlagTopic = (typeof FLAG_TOPICS)[number];

export const HEADLINE_LIMIT = 80;

const JARGON: [RegExp, string][] = [
  [/https?:\/\/|www\./i, "a link (put it in link)"],
  [/\b\d{1,2}:\d{2}\b|\b(?:am|pm)\b/i, "a time (the card shows when it was flagged)"],
  [/(?:^|\s)[~.]?\/[\w.-]+\/|\.(?:sh|mjs|ts|json|md|log)\b/i, "a file path (put it in details)"],
  [/\bcurl\b|\bexit (?:code )?\d+|\bTLS\b|\bHTTP \d{3}\b|\b[45]\d\d error\b|\bstack\b/i, "an error code (put it in details)"],
  [/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/, "a setting's name (put it in details)"],
  [/\bheartbeat\b|\bretr(?:y|ies)\b|\bAPI\b|\bendpoint\b/i, "how the bots work (founders read this)"],
];

/** Why a headline isn't plain enough for a founder to read at a glance, or null when it's fine. */
export function headlineProblem(headline: string): string | null {
  if (headline.length > HEADLINE_LIMIT) return `it's ${headline.length} characters; keep it to ${HEADLINE_LIMIT}`;
  const found = JARGON.find(([pattern]) => pattern.test(headline));
  return found ? `it has ${found[1]}` : null;
}
