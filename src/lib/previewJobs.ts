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

/** A preview build (or rebuild with a note), or a launch onto the client's own Vercel project. */
export const JOB_KINDS = ["preview", "launch"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

/** How many times a lead's build may fail in a row before it's left for a founder. */
export const MAX_FAILED_BUILDS = 2;

/** Settings the founders control from the Projects page. */
export type RunnerSettings = {
  dailyCap: number;
  pausedUntil: string | null;
  outreachPicksPreviews: boolean;
  /** When the queue is empty, the runner's next poll queues the highest-scoring new lead with an email. */
  autoQueue: boolean;
};

export const DEFAULT_RUNNER_SETTINGS: RunnerSettings = { dailyCap: 10, pausedUntil: null, outreachPicksPreviews: false, autoQueue: true };

/** Env var the runner machine keeps its admin key in. */
export const RUNNER_KEY_ENV = "DEFECT_RUNNER_KEY";
