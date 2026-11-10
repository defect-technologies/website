import type { NoteAnchor } from "./review";

/** What one question is about, so its icon tells the founder before they read it. */
export const ASK_TOPICS = ["first-screen", "type", "color", "layout", "copy", "imagery", "motif", "phone"] as const;
export type AskTopic = (typeof ASK_TOPICS)[number];

/** One specific question about one part of a preview, written by Claude before the founder looks. */
export type ReviewAsk = {
  id: string;
  topic: AskTopic;
  question: string;
  /** Why Claude asks: what it saw, or what the design critic said. */
  why: string;
  path: string;
  selector: string;
  /** Words from the element, so the founder and the builder can find it without the selector. */
  quote: string;
};

export const MIN_ASKS = 3;
export const MAX_ASKS = 5;
export const MAX_ASK_TEXT = 300;

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
