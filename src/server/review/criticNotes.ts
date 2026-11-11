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
 * A note this version cannot read is left out instead of failing the whole report: a runner that already knows a newer
 * kind must still be able to finish its build. Only the count is a hard limit.
 */
function readableNotes(items: unknown[]): CriticNote[] {
  const seen = new Set<string>();
  const notes: CriticNote[] = [];
  for (const item of items) {
    const parsed = CriticNoteShape.safeParse(item);
    if (!parsed.success || seen.has(parsed.data.id)) continue;
    seen.add(parsed.data.id);
    notes.push(parsed.data);
  }
  return notes;
}

/** The optional criticNotes of a done report: at most MAX_CRITIC_NOTES, each one valid, unknown fields dropped. */
export const CriticNotesField = z.array(z.unknown()).max(MAX_CRITIC_NOTES).transform(readableNotes).optional();
