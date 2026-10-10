/** Cleaning up what bots paste into emails: links wrapped by mail apps, escaped characters and piled-up subject prefixes. */

/** Link wrappers mail apps add when they show a message, and the query parameter holding the real address. */
const WRAPPERS: { pattern: RegExp; param: string }[] = [
  { pattern: /https?:\/\/(?:www\.)?google\.com\/url\?[^\s<>"')\]]+/gi, param: "q" },
  { pattern: /https?:\/\/[a-z0-9.-]*safelinks\.protection\.outlook\.com\/?\?[^\s<>"')\]]+/gi, param: "url" },
];

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'", "&nbsp;": " " };

/** Gmail tools hand bots HTML-escaped text; the email is plain text, so the entities go back to characters. */
function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g, (entity) => ENTITIES[entity]);
}

function unwrapOne(wrapped: string, param: string): string {
  try {
    return new URL(wrapped).searchParams.get(param) || wrapped;
  } catch {
    return wrapped;
  }
}

/** The body with every wrapped link replaced by the address it points at. */
export function unwrapLinks(text: string): { text: string; unwrapped: number } {
  let unwrapped = 0;
  let result = decodeEntities(text);
  for (const { pattern, param } of WRAPPERS) {
    result = result.replace(pattern, (wrapped) => {
      unwrapped += 1;
      return unwrapOne(wrapped, param);
    });
  }
  return { text: result, unwrapped };
}

/** One "Re:" in front of the thread's own subject, however many the thread has piled up. */
export function replySubject(subject: string): string {
  return `Re: ${subject.replace(/^(?:\s*(?:re|fwd?|aw)\s*:\s*)+/i, "").trim()}`;
}
