// Review by section: a preview tells the admin its sections (site-kit 0.15.1, the review bridge's "sections"), and a
// founder steps through them. For each one, a tap adds one of the notes the founders write most often.

import type { CriticKind, CriticTarget } from "./critics";
import type { Device, NoteAnchor, ReviewNote } from "./review";

/** One section of a preview's page, as the preview reports it. */
export type ReviewSection = { index: number; selector: string; heading: string; top: number };

/** The review bridge version from which a preview can report its sections. */
export const SECTIONS_PROTOCOL = 2;

/**
 * The notes a founder can add to a section with one tap: the six follow-ups Brendan wrote after almost every first
 * build. `target` says where the repair belongs: a font or a palette is the whole site's, the rest is the section's.
 */
export const QUICK_NOTES: { kind: CriticKind; label: string; text: string; target: CriticTarget }[] = [
  { kind: "text", label: "Too much text", text: "Too much text. Cut it to what a visitor needs to decide.", target: "section" },
  { kind: "form", label: "More visual", text: "Make this more visual. Show the information, do not only say it.", target: "section" },
  { kind: "sense", label: "Makes no sense", text: "The presentation here does not make sense. Make clear what this is and what the visitor does with it.", target: "section" },
  { kind: "spacing", label: "Fix spacing", text: "Fix the spacing here. Parts touch, overlap or sit unevenly at this width.", target: "section" },
  { kind: "font", label: "Change font", text: "Change the font. This one does not suit the business.", target: "system" },
  { kind: "palette", label: "Fix colours", text: "The colours are hard to look at. Calm the palette and the contrast.", target: "system" },
];

/** A section as the element a note points at. */
export function sectionAnchor(section: ReviewSection, path: string): NoteAnchor {
  return { path, selector: section.selector, tag: "section", text: section.heading };
}

/** The quick note of this kind on this section, when the founder has already added it. */
export function quickNoteOn(notes: ReviewNote[], section: ReviewSection, kind: CriticKind): ReviewNote | undefined {
  const text = QUICK_NOTES.find((entry) => entry.kind === kind)?.text;
  return notes.find((note) => note.anchor?.selector === section.selector && note.kind === kind && note.text === text);
}

export function quickNote(section: ReviewSection, kind: CriticKind, device: Device, path: string, id: string): ReviewNote | null {
  const quick = QUICK_NOTES.find((entry) => entry.kind === kind);
  if (!quick) return null;
  return { id, text: quick.text, scope: "site", device, path, anchor: sectionAnchor(section, path), kind: quick.kind, target: quick.target };
}

/** The section a founder is looking at: the last one that starts at or above a little below the top of the screen. */
export function sectionInView(sections: ReviewSection[], scrollY: number): number {
  const LOOKING_AT = 160;
  const at = sections.findLastIndex((section) => section.top <= scrollY + LOOKING_AT);
  return Math.max(0, at);
}

function isSection(value: unknown): value is ReviewSection {
  const section = value as ReviewSection | null;
  return Boolean(section) && typeof section?.index === "number" && typeof section.selector === "string" && typeof section.heading === "string" && typeof section.top === "number";
}

/** What a preview reported, kept only when it has the shape the admin steps through. The frame is another site's page. */
export function readSections(value: unknown): ReviewSection[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isSection).slice(0, 40).map(({ index, selector, heading, top }) => ({ index, selector: selector.slice(0, 500), heading: heading.slice(0, 120), top }));
}
