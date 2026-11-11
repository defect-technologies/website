import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { type CriticNote, hasProposals, proposalsFrom, tallyKinds } from "@/lib/critics";
import type { ReviewNote } from "@/lib/review";
import { db } from "../db/client";
import { criticAnswers, previewJobs, previewReviews } from "../db/schema";

export type JobProposals = { jobId: string; notes: CriticNote[] };

/** The notes the newest finished job for this preview reported, or null when it reported none that can be asked about. */
export async function proposalsForPreview(businessId: string, previewUrl: string): Promise<JobProposals | null> {
  const database = await db();
  const [job] = await database
    .select({ id: previewJobs.id, criticNotes: previewJobs.criticNotes })
    .from(previewJobs)
    .where(and(eq(previewJobs.businessId, businessId), eq(previewJobs.previewUrl, previewUrl), eq(previewJobs.status, "done")))
    .orderBy(desc(previewJobs.finishedAt))
    .limit(1);
  if (!job || !hasProposals(job.criticNotes)) return null;
  const answered = await database.select({ proposalId: criticAnswers.proposalId }).from(criticAnswers).where(eq(criticAnswers.jobId, job.id));
  const open = proposalsFrom(job.criticNotes ?? [], new Set(answered.map((row) => row.proposalId)));
  return { jobId: job.id, notes: open };
}

/** Keeps the founder's answer to one proposal. Kind and target come from the stored note, never from the browser. */
export async function recordProposalAnswer(input: { jobId: string; proposalId: string; accepted: boolean; answeredBy: string }): Promise<boolean> {
  const database = await db();
  const [job] = await database.select({ businessId: previewJobs.businessId, criticNotes: previewJobs.criticNotes }).from(previewJobs).where(eq(previewJobs.id, input.jobId));
  const note = job?.criticNotes?.find((candidate) => candidate.id === input.proposalId);
  if (!job || !note) return false;
  await database
    .insert(criticAnswers)
    .values({ jobId: input.jobId, businessId: job.businessId, proposalId: note.id, kind: note.kind, target: note.target, accepted: input.accepted, answeredBy: input.answeredBy })
    .onConflictDoUpdate({ target: [criticAnswers.jobId, criticAnswers.proposalId], set: { accepted: input.accepted, answeredBy: input.answeredBy, answeredAt: new Date() } });
  return true;
}

/** Per kind: proposals accepted, proposals rejected, and notes the founder wrote that no proposal led to. */
export async function kindTallies() {
  const database = await db();
  const answers = await database.select({ kind: criticAnswers.kind, accepted: criticAnswers.accepted }).from(criticAnswers);
  const reviews = await database.select({ notes: previewReviews.notes }).from(previewReviews).where(sql`jsonb_array_length(${previewReviews.notes}) > 0`);
  const written = reviews.flatMap((review) => review.notes as ReviewNote[]);
  return tallyKinds(answers, written);
}
