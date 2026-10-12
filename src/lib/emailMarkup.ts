/** [words](https://...) in an email body: the HTML version shows the words as a link, plain text shows "words (address)". */
const LINK_MARKUP = /\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s()]+)\)/g;

export type TextPart = { text: string; href?: string };

export function linkParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_MARKUP)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: match[1], href: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

export function linksAsPlainText(text: string): string {
  return text.replace(LINK_MARKUP, "$1 ($2)");
}

/** Wraps the selected words as a link, then selects the part the founder fills in next: the address, or the words when none were selected. */
export function withLinkMarkup(text: string, start: number, end: number): { text: string; select: [number, number] } {
  const words = text.slice(start, end) || "link text";
  const markup = `[${words}](https://)`;
  const next = text.slice(0, start) + markup + text.slice(end);
  const select: [number, number] = start === end ? [start + 1, start + 1 + words.length] : [start + words.length + 3, start + markup.length - 1];
  return { text: next, select };
}
