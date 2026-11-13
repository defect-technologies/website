import type { CriticKind, CriticTarget } from "@/lib/critics";
import type { Device, NoteAnchor, NoteScope, ReviewNote } from "@/lib/review";
import { askAnchor, type ReviewAsk, stillWrongText } from "@/lib/reviewAsks";

/** pickedOn is the width the frame had when the element was picked, which is what the note is about. */
export type Draft = { text: string; anchor: NoteAnchor | null; pickedOn: Device | null; scope: NoteScope };

export const EMPTY_DRAFT: Draft = { text: "", anchor: null, pickedOn: null, scope: "site" };

function storageKey(businessId: string, previewUrl: string) {
  return `review-notes:${businessId}:${previewUrl}`;
}

/** Notes not yet sent survive a reload or a closed tab, on this browser only. */
export function readSavedNotes(businessId: string, previewUrl: string): ReviewNote[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(businessId, previewUrl)) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function saveNotes(businessId: string, previewUrl: string, notes: ReviewNote[]) {
  try {
    const key = storageKey(businessId, previewUrl);
    if (notes.length) window.localStorage.setItem(key, JSON.stringify(notes));
    else window.localStorage.removeItem(key);
  } catch {
    // Private windows can refuse storage; the notes still live in the page.
  }
}

export function noteFromDraft(draft: Draft, device: Device, path: string, classification: { kind?: CriticKind; target?: CriticTarget } = {}): ReviewNote {
  return { id: crypto.randomUUID(), text: draft.text.trim(), scope: draft.scope, device: draft.pickedOn ?? device, path, anchor: draft.anchor, ...classification };
}

/** A proposal the founder said yes to becomes his own note, and keeps the proposal's id so it is not counted as one he wrote himself. */
export function noteFromProposal(ask: ReviewAsk): ReviewNote | null {
  const { proposal } = ask;
  if (!proposal) return null;
  return { id: crypto.randomUUID(), text: proposal.text, scope: "site", device: proposal.device, path: ask.path, anchor: askAnchor(ask), kind: proposal.kind, target: proposal.target, proposalId: proposal.id };
}

/** A repair that did not fix its note gives the founder the note back, on the same element at the same width. */
export function noteFromRepair(ask: ReviewAsk): ReviewNote | null {
  const { repair } = ask;
  if (!repair) return null;
  const anchor = askAnchor(ask);
  return { id: crypto.randomUUID(), text: stillWrongText(ask.question), scope: "site", device: repair.device, path: ask.path, anchor: anchor && { ...anchor, tag: repair.tag } };
}

/** Dictated phrases join the draft as sentences. */
export function appendPhrase(text: string, phrase: string): string {
  const spoken = phrase.charAt(0).toUpperCase() + phrase.slice(1);
  const ended = /[.!?]$/.test(spoken) ? spoken : `${spoken}.`;
  return text.trim() ? `${text.trimEnd()} ${ended}` : ended;
}

export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
