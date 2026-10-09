import type { EditableContent, Service } from "@/lib/siteContent";

/** List rows carry a key so React keeps focus on the right input while rows move. */
export type Keyed<T> = T & { key: string };
export type DraftService = Keyed<Required<Service>>;
export type DraftParagraph = Keyed<{ text: string }>;

export type Draft = Omit<EditableContent, "services" | "aboutParagraphs"> & {
  services: DraftService[];
  aboutParagraphs: DraftParagraph[];
};

let nextKey = 0;
/** Keys for rows added in the browser. Rows from the server get index keys, so server and client render the same ids. */
export const newKey = () => `added-${nextKey++}`;

export function toDraft(content: EditableContent): Draft {
  return {
    ...content,
    services: content.services.map((service, index) => ({ ...service, key: `service-${index}` })),
    aboutParagraphs: content.aboutParagraphs.map((text, index) => ({ text, key: `paragraph-${index}` })),
  };
}

export function fromDraft(draft: Draft): EditableContent {
  return {
    ...draft,
    services: draft.services.map((service) => ({ name: service.name, description: service.description, price: service.price })),
    aboutParagraphs: draft.aboutParagraphs.map((paragraph) => paragraph.text),
  };
}

export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
