/** A flag worker session ends within 60 minutes; a claim older than this has no session behind it any more. */
export const STALE_CLAIM_MS = 75 * 60 * 1000;

const CLAIM_TIME = /\d{4}-\d{2}-\d{2}T[\d:.]+Z/;

export const claimStartedAt = (note: string): string | undefined => CLAIM_TIME.exec(note)?.[0];

export function isStaleClaim(note: string, now = Date.now()): boolean {
  const started = claimStartedAt(note);
  return Boolean(started) && now - new Date(started as string).getTime() > STALE_CLAIM_MS;
}
