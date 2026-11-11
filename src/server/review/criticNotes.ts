import { z } from "zod";
import { CRITIC_DEVICES, CRITIC_KINDS, CRITIC_STATUSES, CRITIC_TARGETS, MAX_CRITIC_FIELD, MAX_CRITIC_NOTES, MAX_CRITIC_QUOTE, MAX_CRITIC_TEXT, type CriticNote } from "@/lib/critics";

const CriticNoteShape = z.object({
  id: z.string().trim().min(1).max(100),
  target: z.enum(CRITIC_TARGETS),
  kind: z.enum(CRITIC_KINDS),
  path: z.string().max(MAX_CRITIC_FIELD),
  device: z.enum(CRITIC_DEVICES),
  selector: z.string().max(MAX_CRITIC_FIELD),
  quote: z.string().max(MAX_CRITIC_QUOTE),
  text: z.string().trim().min(1).max(MAX_CRITIC_TEXT),
  source: z.string().max(100),
  model: z.string().max(100),
  status: z.enum(CRITIC_STATUSES),
});

/**
 * A note this version cannot read, and any note past the limit, is left out instead of failing the whole report: a
 * finished build must always be able to report, whatever its runner sends.
 */
function readableNotes(items: unknown[]): CriticNote[] {
  const seen = new Set<string>();
  const notes: CriticNote[] = [];
  for (const item of items.slice(0, MAX_CRITIC_NOTES)) {
    const parsed = CriticNoteShape.safeParse(item);
    if (!parsed.success || seen.has(parsed.data.id)) continue;
    seen.add(parsed.data.id);
    notes.push(parsed.data);
  }
  return notes;
}

/** The optional criticNotes of a done report: the first MAX_CRITIC_NOTES, each one valid, unknown fields dropped. */
export const CriticNotesField = z.array(z.unknown()).transform(readableNotes).optional();
