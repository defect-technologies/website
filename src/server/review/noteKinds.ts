import { CRITIC_KINDS, CRITIC_TARGETS, type CriticKind, type CriticTarget } from "@/lib/critics";

export type NoteClass = { kind: CriticKind; target: CriticTarget };

/** What a note is classed as when Claude is not set up or fails. */
export const FALLBACK_CLASS: NoteClass = { kind: "other", target: "section" };

export const KIND_GUIDE = [
  `- kind: one of ${CRITIC_KINDS.join(", ")}. sense: the presentation does not make sense. text: too much text. form: the information should be shown in a more visual form. spacing: margins, padding, or items that touch, overlap or crowd. font: change the font. palette: the contrast or colours are hard to look at. cohesion: the sections do not fit together. other: anything else.`,
  `- target: one of ${CRITIC_TARGETS.join(", ")}. system: the fix belongs in the styles every section shares, so it applies to every section. seam: the fix belongs at the boundary between two sections. section: the fix belongs in one section.`,
].join("\n");

export const CLASS_SCHEMA_PROPERTIES = {
  kind: { type: "string", enum: [...CRITIC_KINDS] },
  target: { type: "string", enum: [...CRITIC_TARGETS] },
};
