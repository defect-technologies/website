import { type CriticDevice, type CriticKind, type CriticNote, type CriticTarget, proposalWords } from "./critics";
import type { RepairCheck } from "./repairs";
import type { Device, NoteAnchor } from "./review";

/** What one question is about, so its icon tells the founder before they read it. */
export const ASK_TOPICS = ["first-screen", "type", "color", "layout", "copy", "imagery", "motif", "phone"] as const;
export type AskTopic = (typeof ASK_TOPICS)[number];

/** One specific question about one part of a preview, written by Claude before the founder looks. */
export type ReviewAsk = {
  id: string;
  topic: AskTopic;
  /** At most MAX_ASK_WORDS words: the outlined element on the page says what it's about. */
  question: string;
  path: string;
  selector: string;
  /** Words from the element, so the founder and the builder can find it without the selector. */
  quote: string;
  /** Set when the question is a critic's proposal: yes makes it one of the founder's notes, no is kept as a rejection. */
  proposal?: AskProposal;
  /** Set when the question is one of the founder's own notes after its repair: is it fixed? */
  repair?: AskRepair;
};

/** A repaired note's spot on the preview the founder looked at (empty when it could not be pictured) and on the new one. */
export type AskRepair = { before: string; after: string; device: Device; tag: string; focus?: number };

/** What the stage shows for a repaired note: one of its two pictures, or the live preview to try the page. */
export const REPAIR_VIEWS = ["before", "after", "live"] as const;
export type RepairView = (typeof REPAIR_VIEWS)[number];

/** The question is the founder's own note, in their words. */
export function askFromRepair(check: RepairCheck): ReviewAsk {
  const anchor = check.anchor;
  return {
    id: `repair:${check.id}`,
    topic: "layout",
    question: check.text,
    path: anchor?.path ?? check.path,
    selector: anchor?.selector ?? "",
    quote: anchor?.text ?? "",
    repair: { before: check.before, after: check.after, device: check.device, tag: anchor?.tag ?? "", ...(check.focus === undefined ? {} : { focus: check.focus }) },
  };
}

/** The note a founder gets back when a repair did not fix what they asked for. */
export function stillWrongText(original: string): string {
  return `Still wrong after the repair: ${original}`;
}

/** The critic note behind a question, with the job that reported it so the founder's answer can be kept. */
export type AskProposal = { jobId: string; id: string; kind: CriticKind; target: CriticTarget; device: CriticDevice; text: string };

/** The most proposals one preview asks about, so a long list of critic notes never becomes a long chore. */
export const MAX_PROPOSALS = 8;

const KIND_TOPIC: Record<CriticKind, AskTopic> = {
  sense: "layout",
  text: "copy",
  form: "imagery",
  spacing: "layout",
  font: "type",
  palette: "color",
  cohesion: "layout",
  other: "layout",
};

export function askFromProposal(jobId: string, note: CriticNote): ReviewAsk {
  const { id, kind, target, device, text } = note;
  return { id: `proposal:${id}`, topic: KIND_TOPIC[kind], question: proposalWords(text), path: note.path, selector: note.selector, quote: note.quote, proposal: { jobId, id, kind, target, device, text } };
}

export const MIN_ASKS = 3;
export const MAX_ASKS = 5;
export const MAX_ASK_WORDS = 8;
export const MAX_ASK_TEXT = 80;

/** The element a question is about, as the anchor of the founder's answer. */
export function askAnchor(ask: ReviewAsk): NoteAnchor | null {
  if (!ask.selector) return null;
  return { path: ask.path, selector: ask.selector, tag: "", text: ask.quote };
}

/** The page part of a path, so "/menu/?a=1" and "/menu" count as the same page. Matches site-kit's samePage. */
export function samePage(a: string, b: string): boolean {
  const page = (path: string) => {
    const bare = path.split(/[?#]/)[0] || "/";
    return bare.length > 1 ? bare.replace(/\/+$/, "") : bare;
  };
  return page(a) === page(b);
}
