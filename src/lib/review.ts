import { type CriticKind, type CriticTarget, TARGET_SENTENCE } from "./critics";
import { byFounder, founderName } from "./founders";

export const REVIEW_VERDICTS = ["approved", "changes"] as const;
export type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];

export const DEVICES = ["desktop", "tablet", "phone"] as const;
export type Device = (typeof DEVICES)[number];

export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1440, tablet: 768, phone: 390 };

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
  device: Device;
  /** The page the frame was on when the note was written. */
  path: string;
  anchor: NoteAnchor | null;
  /** What the note is about, and where its repair belongs. Notes saved before critics have neither. */
  kind?: CriticKind;
  target?: CriticTarget;
  /** The critic note this one was accepted from. A note without it is one the founder wrote himself. */
  proposalId?: string;
};

export const MAX_NOTE_TEXT = 2000;
export const MAX_NOTES = 40;
/** The runner passes the whole note on the command line, so the compiled note stays well under argv limits. */
export const MAX_COMPILED_NOTE = 16000;

function quoted(text: string): string {
  return text ? ` ("${text.replace(/\s+/g, " ").trim()}")` : "";
}

function whereLine(note: ReviewNote): string {
  const width = `${note.device} width, ${DEVICE_WIDTH[note.device]} px`;
  if (note.anchor) return `On ${note.anchor.path} at ${width}, the ${note.anchor.tag ? `<${note.anchor.tag}>` : "element"} at \`${note.anchor.selector}\`${quoted(note.anchor.text)}`;
  return `On ${note.path || "/"} at ${width}, the page as a whole`;
}

/**
 * The founder's notes as the builder's --note: one numbered change per note, each with the page, width and element
 * it points at, so the builder can find the exact spot without a screenshot.
 */
export function compileReviewNote(notes: ReviewNote[], previewUrl: string): string {
  const lines = notes.map((note, index) => {
    const targetSentence = note.target ? ` ${TARGET_SENTENCE[note.target]}` : "";
    return `${index + 1}. ${whereLine(note)}: ${note.text.trim()}${targetSentence}`;
  });
  const head = `A founder reviewed the preview at ${previewUrl} and wants these changes. Make every one of them; where a note names an element, change that element and anything else on the site with the same problem.`;
  return [head, "", ...lines].join("\n").slice(0, MAX_COMPILED_NOTE);
}

/**
 * lead/taste.md: each founder's standing lessons under their name. The two founders' taste is kept apart because it can
 * differ; where it does, the founder who chose the design decides.
 */
export function tasteMarkdown(lessons: { text: string; createdBy: string }[]): string {
  if (!lessons.length) return "";
  const intro =
    "These are the founders' standing rules of taste, each under the founder who wrote it. They outrank DESIGN.md's defaults where the two conflict, and every one must hold on this site unless the other founder's lesson says the opposite. Where the founders' lessons disagree, design/board.md names the founder who chose this design: follow theirs. While three options are drawn, let one option follow one founder's lesson and another option the other's.";
  const sections = byFounder(lessons.map((lesson) => ({ by: founderName(lesson.createdBy), text: lesson.text }))).flatMap(([by, theirs]) => [
    `## ${by}`,
    "",
    ...theirs.map((lesson) => `- ${lesson.text.replace(/\s+/g, " ").trim()}`),
    "",
  ]);
  return ["# Founder taste lessons", "", intro, "", ...sections].join("\n");
}

/** The rebuild a preview gets so the review page can point at its elements; it only moves the site to the newest kit. */
export const POINTING_NOTE =
  "Rebuild only to take the newest site-kit, so the founders' review page can point at elements in this preview. Keep the design, content, pages and wording exactly as they are.";
