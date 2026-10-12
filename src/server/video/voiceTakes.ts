import "server-only";
import { list } from "@vercel/blob";
import { lineIdOf, VOICE_FOLDER } from "@/lib/voiceTakes";
import { env } from "../env";

export type VoiceTake = { url: string; uploadedAt: Date };

/** The newest take of each line, by line id. */
export async function latestVoiceTakes(): Promise<Record<string, VoiceTake>> {
  const token = env.brandFilesToken();
  if (!token) return {};
  const { blobs } = await list({ prefix: VOICE_FOLDER, token, limit: 1000 });
  const latest: Record<string, VoiceTake> = {};
  for (const blob of blobs) {
    const id = lineIdOf(blob.pathname);
    if (id && (!latest[id] || blob.uploadedAt > latest[id].uploadedAt)) latest[id] = { url: blob.url, uploadedAt: blob.uploadedAt };
  }
  return latest;
}
