/** The message for a key that came from the address bar. A name every object has, such as "constructor", gives none. */
export function messageFor(messages: Record<string, string>, key: string | undefined): string | undefined {
  return key !== undefined && Object.hasOwn(messages, key) ? messages[key] : undefined;
}
