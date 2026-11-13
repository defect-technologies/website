import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { type RepairCheck, repairChecksOf, type RepairNotes } from "@/lib/repairs";
import { MAX_NOTES } from "@/lib/review";
import { isRepairPicture, isRepairPictureName, MAX_PICTURE_BYTES, storeRepairPicture } from "../boards/pictures";
import { BotError } from "../bots/http";
import { db } from "../db/client";
import { previewJobs, previewReviews } from "../db/schema";
import { isActive, jobById } from "./jobs";

/**
 * The founder's notes behind a repair of this preview: the newest review that asked for changes to it. The runner
 * pictures each note's spot from them. Null when no founder reviewed this preview, as with a note from the lead page.
 */
export async function repairNotesFor(businessId: string, previewUrl: string): Promise<RepairNotes | null> {
  if (!previewUrl) return null;
  const [review] = await (await db())
    .select({ notes: previewReviews.notes })
    .from(previewReviews)
    .where(and(eq(previewReviews.businessId, businessId), eq(previewReviews.previewUrl, previewUrl), eq(previewReviews.verdict, "changes")))
    .orderBy(desc(previewReviews.reviewedAt))
    .limit(1);
  if (!review?.notes.length) return null;
  return { previewUrl, notes: review.notes.map(({ id, text, device, path, anchor }) => ({ id, text, device, path, anchor })) };
}

/** PUT /api/runner/:job/repairs/:picture, the JPEG as the body. The picture is "1-before" or "1-after", numbered by note. */
export async function uploadRepairPicture(id: string, name: string, request: Request) {
  const job = await jobById(id);
  if (!job) throw new BotError(404, "No preview job has that ID.");
  if (!isActive(job.status) || job.status === "queued" || job.kind !== "preview") throw new BotError(409, `That job is ${job.status}, not a preview being built.`);
  if (!isRepairPictureName(name)) throw new BotError(400, `"${name}" is not a repair picture. Send 1-before or 1-after, numbered by note.`);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PICTURE_BYTES) throw new BotError(413, "A repair picture is a JPEG of 4 MB at most.");
  return { url: await storeRepairPicture(job.businessId, job.id, name, bytes) };
}

const Picture = z.url({ protocol: /^https$/ }).max(500);

/** The pictures the runner took for a repair, by note id, in its done report. */
export const RepairsField = z
  .array(z.object({ id: z.string().min(1).max(64), before: Picture.optional(), after: Picture.optional(), focus: z.number().min(0).max(1).optional() }))
  .max(MAX_NOTES)
  .optional();

/**
 * What the Review page shows of a repair: each of the founder's notes with its two pictures. Only a picture this
 * lead's runner job stored counts, and a note with no picture of the new preview is left out: there is nothing to
 * answer it from. `notes` are the ones the runner was handed (repairNotesFor, read before the lead's preview changes).
 */
export function repairChecks(businessId: string, notes: RepairNotes | null, reported: z.infer<typeof RepairsField>): RepairCheck[] {
  const ours = (url: string | undefined) => (url && isRepairPicture(url, businessId) ? url : "");
  const pictures = new Map((reported ?? []).map((entry) => [entry.id, entry]));
  return (notes?.notes ?? []).flatMap((note) => {
    const sent = pictures.get(note.id);
    const after = ours(sent?.after);
    return after ? [{ ...note, before: ours(sent?.before), after, ...(sent?.focus === undefined ? {} : { focus: sent.focus }) }] : [];
  });
}

/** The repair checks of the build that made this preview, for the Review page. Empty when it was not a repair. */
export async function repairChecksForPreview(businessId: string, previewUrl: string): Promise<RepairCheck[]> {
  const [job] = await (await db())
    .select({ result: previewJobs.result })
    .from(previewJobs)
    .where(and(eq(previewJobs.businessId, businessId), eq(previewJobs.previewUrl, previewUrl), eq(previewJobs.status, "done")))
    .orderBy(desc(previewJobs.finishedAt))
    .limit(1);
  return repairChecksOf(job?.result);
}
