import "server-only";
import { and, desc, eq, gte, inArray, isNull, ne } from "drizzle-orm";
import { ACTIVE_JOB_STATUSES } from "@/lib/previewJobs";
import { rebuildNote, type TasteItemStatus, type TasteNote, type TasteVerdict } from "@/lib/taste";
import { record } from "./activity";
import { openFlagOn } from "./bots/flags";
import { db } from "./db/client";
import { businesses, previewJobs, tasteNotes, tasteReviews } from "./db/schema";
import { approvePreview } from "./leads/approvePreview";
import { businessById } from "./leads/businesses";
import { requestPreview } from "./runner/jobs";

/** The preview cleanup deletes deployments after 30 days, so older ones can't be looked at. */
const PREVIEW_LIFETIME_DAYS = 30;

export type TasteEntry = {
  jobId: string;
  businessId: string;
  businessName: string;
  previewUrl: string;
  builtAt: string | null;
  criticVerdict: string;
};

/**
 * Every finished preview a founder hasn't reviewed yet, newest first: the latest one per business, skipping
 * businesses with a build already running, since that build replaces what's on screen.
 */
export async function tasteQueue(): Promise<TasteEntry[]> {
  const since = new Date(Date.now() - PREVIEW_LIFETIME_DAYS * 86_400_000);
  const database = await db();
  const [built, building] = await Promise.all([
    database
      .select({
        jobId: previewJobs.id,
        businessId: previewJobs.businessId,
        businessName: businesses.businessName,
        previewUrl: previewJobs.previewUrl,
        finishedAt: previewJobs.finishedAt,
        criticVerdict: previewJobs.criticVerdict,
      })
      .from(previewJobs)
      .innerJoin(businesses, eq(previewJobs.businessId, businesses.id))
      .leftJoin(tasteReviews, eq(tasteReviews.previewUrl, previewJobs.previewUrl))
      .where(and(eq(previewJobs.kind, "preview"), eq(previewJobs.status, "done"), ne(previewJobs.previewUrl, ""), gte(previewJobs.finishedAt, since), isNull(tasteReviews.id)))
      .orderBy(desc(previewJobs.finishedAt)),
    database.select({ businessId: previewJobs.businessId }).from(previewJobs).where(inArray(previewJobs.status, [...ACTIVE_JOB_STATUSES])),
  ]);
  const skip = new Set(building.map((job) => job.businessId));
  const entries: TasteEntry[] = [];
  for (const row of built) {
    if (skip.has(row.businessId)) continue;
    skip.add(row.businessId);
    entries.push({ ...row, builtAt: row.finishedAt?.toISOString() ?? null });
  }
  return entries;
}

export type TasteReviewInput = {
  jobId: string;
  previewUrl: string;
  verdict: TasteVerdict;
  transcript: string;
  notes: TasteNote[];
};

export type TasteReviewResult = { saved: boolean; rebuilt: boolean; rules: number };

/** Approving a preview the runner held for a founder releases it, the same as Ready to send on Today. */
async function releaseIfHeld(businessId: string, previewUrl: string, founderEmail: string) {
  const lead = await businessById(businessId);
  if (lead && (await openFlagOn(lead.id, "preview-review"))) await approvePreview(lead, previewUrl, founderEmail);
}

async function queueRebuild(businessId: string, notes: TasteNote[], founderEmail: string) {
  const note = rebuildNote(notes);
  const lead = note ? await businessById(businessId) : null;
  if (!lead) return null;
  const { job, created } = await requestPreview(lead, founderEmail, note);
  return created ? job.id : null;
}

function noteStatus(note: TasteNote, rebuildJobId: string | null): TasteItemStatus {
  if (note.scope === "all") return "rule_pending";
  return rebuildJobId ? "queued" : "unsent";
}

/** Saves the review, then rebuilds the preview with this site's notes and keeps the rest for site-kit's rules. */
export async function saveTasteReview(input: TasteReviewInput, founderEmail: string): Promise<TasteReviewResult> {
  const database = await db();
  const [job] = await database.select({ businessId: previewJobs.businessId }).from(previewJobs).where(and(eq(previewJobs.id, input.jobId), eq(previewJobs.previewUrl, input.previewUrl)));
  if (!job) return { saved: false, rebuilt: false, rules: 0 };
  const [review] = await database
    .insert(tasteReviews)
    .values({ businessId: job.businessId, jobId: input.jobId, previewUrl: input.previewUrl, verdict: input.verdict, transcript: input.transcript, reviewedBy: founderEmail })
    .onConflictDoNothing()
    .returning({ id: tasteReviews.id });
  if (!review) return { saved: false, rebuilt: false, rules: 0 };

  if (input.verdict === "approved") await releaseIfHeld(job.businessId, input.previewUrl, founderEmail);
  const rebuildJobId = input.verdict === "changes" ? await queueRebuild(job.businessId, input.notes, founderEmail) : null;
  if (rebuildJobId) await database.update(tasteReviews).set({ rebuildJobId }).where(eq(tasteReviews.id, review.id));
  if (input.notes.length) {
    await database.insert(tasteNotes).values(input.notes.map((note) => ({ ...note, reviewId: review.id, businessId: job.businessId, status: noteStatus(note, rebuildJobId) })));
  }
  const rules = input.notes.filter((note) => note.scope === "all").length;
  await record(founderEmail, input.verdict === "approved" ? "approved a preview's design" : "gave design notes on a preview", { businessId: job.businessId, detail: input.previewUrl });
  return { saved: true, rebuilt: Boolean(rebuildJobId), rules };
}
