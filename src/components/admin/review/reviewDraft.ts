import type { Device, NoteAnchor, NoteScope, ReviewNote } from "@/lib/review";

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

export function noteFromDraft(draft: Draft, device: Device, path: string): ReviewNote {
  return { id: crypto.randomUUID(), text: draft.text.trim(), scope: draft.scope, device: draft.pickedOn ?? device, path, anchor: draft.anchor };
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
