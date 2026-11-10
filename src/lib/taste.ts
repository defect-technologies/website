/** What a founder's taste note is about. */
export const TASTE_CATEGORIES = ["layout", "type", "color", "contrast", "copy", "structure", "motif", "other"] as const;
export type TasteCategory = (typeof TASTE_CATEGORIES)[number];

export const TASTE_CATEGORY_LABEL: Record<TasteCategory, string> = {
  layout: "Layout",
  type: "Type",
  color: "Color",
  contrast: "Contrast",
  copy: "Copy",
  structure: "Structure",
  motif: "Motif",
  other: "Other",
};

/** "site" fixes this preview with a rebuild; "all" becomes a rule for every future site. */
export const TASTE_SCOPES = ["site", "all"] as const;
export type TasteScope = (typeof TASTE_SCOPES)[number];

export const TASTE_VERDICTS = ["approved", "changes"] as const;
export type TasteVerdict = (typeof TASTE_VERDICTS)[number];

/**
 * queued: sent to the runner as a rebuild note. unsent: a rebuild was already running, so the note waits.
 * rule_pending: an "all sites" note waiting to become a site-kit rule.
 */
export const TASTE_ITEM_STATUSES = ["queued", "unsent", "rule_pending", "rule", "dismissed"] as const;
export type TasteItemStatus = (typeof TASTE_ITEM_STATUSES)[number];

export type TasteNote = { scope: TasteScope; category: TasteCategory; text: string };

export const MAX_TRANSCRIPT = 8000;
export const MAX_NOTE_TEXT = 600;
/** The runner's rebuild note is capped at this length (requestPreviewAction). */
export const MAX_REBUILD_NOTE = 2000;

const REBUILD_HEADING = "A founder reviewed this preview's design. Fix each point on every page it applies to:";

/** The rebuild note for this site's notes, dropping whole notes that would push it past the runner's limit. */
export function rebuildNote(notes: TasteNote[]): string {
  let note = REBUILD_HEADING;
  for (const { scope, category, text } of notes) {
    if (scope !== "site") continue;
    const line = `\n- ${TASTE_CATEGORY_LABEL[category]}: ${text.trim()}`;
    if (note.length + line.length > MAX_REBUILD_NOTE) break;
    note += line;
  }
  return note === REBUILD_HEADING ? "" : note;
}

/** How long a review waits before it sends itself, so a founder can stop it. Matches --animate-countdown. */
export const TASTE_SEND_SECONDS = 5;
