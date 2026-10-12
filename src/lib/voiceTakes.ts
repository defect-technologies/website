import { VOICE_LINES } from "@/content/welcomeVideoScript";

/** Browsers record in WebM (Chrome, Firefox) or MP4 (Safari). */
export const VOICE_TAKE_TYPES = ["audio/webm", "audio/mp4", "audio/ogg"] as const;
export const MAX_VOICE_TAKE_BYTES = 10 * 1024 * 1024;

export const VOICE_FOLDER = "video/voiceover/";

/** A line's takes are named after it, so the newest one under its name is the one we use. */
export const takePath = (lineId: string, extension: string) => `${VOICE_FOLDER}${lineId}.${extension}`;

/** The line a take belongs to. Blob adds a random suffix after a dash, and ids have dashes too, so the longest id that fits wins. */
export function lineIdOf(pathname: string): string | null {
  if (!pathname.startsWith(VOICE_FOLDER)) return null;
  const name = pathname.slice(VOICE_FOLDER.length);
  const fits = VOICE_LINES.filter((line) => name.startsWith(`${line.id}.`) || name.startsWith(`${line.id}-`));
  return fits.sort((a, b) => b.id.length - a.id.length)[0]?.id ?? null;
}
