/** Where a preview build is. Active ones block a second build of the same lead. */
export const PREVIEW_JOB_STATUSES = ["queued", "claimed", "running", "done", "failed", "waiting_for_usage"] as const;
export type PreviewJobStatus = (typeof PREVIEW_JOB_STATUSES)[number];

export const ACTIVE_JOB_STATUSES = ["queued", "claimed", "running"] as const satisfies readonly PreviewJobStatus[];

export const FINISHED_JOB_STATUSES = ["done", "failed", "waiting_for_usage"] as const satisfies readonly PreviewJobStatus[];

export const JOB_STATUS_LABEL: Record<PreviewJobStatus, string> = {
  queued: "Queued",
  claimed: "Starting",
  running: "Building",
  done: "Built",
  failed: "Failed",
  waiting_for_usage: "Waiting for Claude usage",
};

/**
 * A build the runner skipped before building: a look at the business's current site found it already good, so a
 * redesign wouldn't win them over. Stored as a failed job with this step (no migration needed), never retried,
 * not counted against the daily cap, and shown as its own lead status.
 */
export const SKIPPED_STEP = "Skipped: their site is already good";

export function isSkipped(job: { status: PreviewJobStatus; step?: string | null } | null | undefined): boolean {
  return job?.status === "failed" && job.step === SKIPPED_STEP;
}

/**
 * A build that stopped after it made the lead's design boards: a founder chooses one, and that choice queues the job
 * that builds the site. Stored as a done job with this step (no migration needed). It builds nothing, so it isn't
 * counted against the daily cap or as a success after failures.
 */
export const BOARDS_STEP = "Three designs for a founder to choose from";

export function isBoards(job: { status: PreviewJobStatus; step?: string | null } | null | undefined): boolean {
  return job?.status === "done" && job.step === BOARDS_STEP;
}

/** How a finished build ended, in the order the Builds page lists them. */
export const BUILD_OUTCOMES = ["built", "launched", "boards", "failed", "skipped", "paused"] as const;
export type BuildOutcome = (typeof BUILD_OUTCOMES)[number];

export const BUILD_OUTCOME_LABEL: Record<BuildOutcome, string> = { built: "Built", launched: "Launched", boards: "Boards sent", failed: "Failed", skipped: "Skipped", paused: "Paused" };

export function buildOutcome(job: { status: PreviewJobStatus; step?: string | null; kind?: string | null }): BuildOutcome {
  if (isSkipped(job)) return "skipped";
  if (isBoards(job)) return "boards";
  if (job.status === "failed") return "failed";
  if (job.status === "waiting_for_usage") return "paused";
  return job.kind === "launch" ? "launched" : "built";
}

/** The outcomes a `?hide=failed,skipped` value names. Anything else in it is ignored. */
export function hiddenOutcomes(value: string | undefined): BuildOutcome[] {
  const named = new Set((value ?? "").split(","));
  return BUILD_OUTCOMES.filter((outcome) => named.has(outcome));
}

/** A preview build (or rebuild with a note), or a launch onto the client's own Vercel project. */
export const JOB_KINDS = ["preview", "launch"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

/** How many times a lead's build may fail in a row before it's left for a founder. */
export const MAX_FAILED_BUILDS = 2;

/** The engine strips this exact text to tell an automatic retry from a founder's note: change it there in the same release. */
export const RETRY_NOTE = "The last build of this site failed. Read verify/report.md and the latest design/review-*.md, and fix every failure they list before anything else.";

/** What a founder wrote in a job's note, without the automatic retry's own words. */
export function founderNote(note: string): string {
  return note.replace(RETRY_NOTE, "").trim();
}

/** The line in a note that asks the builder for a new design. The pipeline reads the same line (pipeline.py, note_lines). */
export function asksForNewDesign(note: string): boolean {
  return note.split("\n").some((line) => line.trim().toLowerCase().replace(/\.+$/, "") === "start a new design");
}

/**
 * Whether a build with this note changes the preview the lead already has. That build keeps the preview's design, so it
 * makes no design boards: boards would stop it and replace the design the founder wrote about.
 */
export function changesBuiltPreview(note: string, previewUrl: string): boolean {
  const written = founderNote(note);
  return Boolean(written) && Boolean(previewUrl) && !asksForNewDesign(written);
}

/** Settings the founders control from Setup > Bots. */
export type RunnerSettings = {
  dailyCap: number;
  pausedUntil: string | null;
  outreachPicksPreviews: boolean;
  /** When the queue is empty, the runner's next poll queues the highest-scoring new lead with an email. */
  autoQueue: boolean;
  /** A first build stops after it made three design boards, and goes on when a founder has chosen one. */
  designBoards: boolean;
};

export const DEFAULT_RUNNER_SETTINGS: RunnerSettings = { dailyCap: 10, pausedUntil: null, outreachPicksPreviews: false, autoQueue: true, designBoards: true };

/** The runner stops queuing new leads by itself while this many boards wait for a founder: a choice is the slow part. */
export const MOST_BOARDS_WAITING = 5;

/** Env var the runner machine keeps its admin key in. */
export const RUNNER_KEY_ENV = "DEFECT_RUNNER_KEY";
