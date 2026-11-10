export const REVIEW_VERDICTS = ["approved", "changes"] as const;
export type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];

export const NOTE_SCOPES = ["site", "every"] as const;
/** "site" changes only this preview; "every" also becomes a taste lesson for every build after it. */
export type NoteScope = (typeof NOTE_SCOPES)[number];

export const DEVICES = ["desktop", "phone"] as const;
export type Device = (typeof DEVICES)[number];

export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1440, phone: 390 };

/** The element a note points at, as the preview's review bridge reported it. */
export type NoteAnchor = {
  path: string;
  selector: string;
  tag: string;
  text: string;
};

export type ReviewNote = {
  id: string;
  text: string;
  scope: NoteScope;
  device: Device;
  /** The page the frame was on when the note was written. */
  path: string;
  anchor: NoteAnchor | null;
};

export const MAX_NOTE_TEXT = 2000;
/** On a phone, notes send themselves this many seconds after the founder stops talking, unless they touch the page. */
export const AUTO_SEND_SECONDS = 5;
export const MAX_NOTES = 40;
/** The runner passes the whole note on the command line, so the compiled note stays well under argv limits. */
export const MAX_COMPILED_NOTE = 16000;

function quoted(text: string): string {
  return text ? ` ("${text.replace(/\s+/g, " ").trim()}")` : "";
}

function whereLine(note: ReviewNote): string {
  const width = `${note.device} width, ${DEVICE_WIDTH[note.device]} px`;
  if (note.anchor) return `On ${note.anchor.path} at ${width}, the <${note.anchor.tag}> at \`${note.anchor.selector}\`${quoted(note.anchor.text)}`;
  return `On ${note.path || "/"} at ${width}, the page as a whole`;
}

/**
 * The founder's notes as the builder's --note: one numbered change per note, each with the page, width and element
 * it points at, so the builder can find the exact spot without a screenshot.
 */
export function compileReviewNote(notes: ReviewNote[], previewUrl: string): string {
  const lines = notes.map((note, index) => {
    const lesson = note.scope === "every" ? " This is also a standing taste lesson for every site (lead/taste.md)." : "";
    return `${index + 1}. ${whereLine(note)}: ${note.text.trim()}${lesson}`;
  });
  const head = `A founder reviewed the preview at ${previewUrl} and wants these changes. Make every one of them; where a note names an element, change that element and anything else on the site with the same problem.`;
  return [head, "", ...lines].join("\n").slice(0, MAX_COMPILED_NOTE);
}

export function tasteMarkdown(lessons: { text: string }[]): string {
  if (!lessons.length) return "";
  const intro =
    "These are the founders' standing rules of taste, written while reviewing earlier previews. They outrank DESIGN.md's defaults where the two conflict, and every one must hold on this site.";
  return ["# Founder taste lessons", "", intro, "", ...lessons.map((lesson) => `- ${lesson.text.replace(/\s+/g, " ").trim()}`), ""].join("\n");
}
