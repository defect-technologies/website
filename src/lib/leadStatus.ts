import type { Bot } from "./bots";
import type { PreviewJobStatus } from "./previewJobs";
import type { Stage } from "./stages";

/**
 * Where a lead is, in the order it moves. The stage alone can't say this: a new
 * lead might be untouched, queued, building, or stuck on a failed build, which
 * only its latest preview job knows. Live leads are clients and have no status.
 */
export const LEAD_STATUSES = ["not_queued", "queued", "building", "build_failed", "ready_to_send", "waiting", "negotiating", "setting_up", "closed"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  not_queued: "Not queued",
  queued: "Queued",
  building: "Building",
  build_failed: "Build failed",
  ready_to_send: "Built, not emailed",
  waiting: "Waiting for reply",
  negotiating: "Negotiating",
  setting_up: "Paid, setting up",
  closed: "Closed",
};

/** Who moves the lead on from here. Founders send first emails; nobody owns a lead until it's queued. */
export type Owner = Bot | "founders" | "nobody";

export const LEAD_STATUS_OWNER: Record<LeadStatus, Owner> = {
  not_queued: "nobody",
  queued: "runner",
  building: "runner",
  build_failed: "founders",
  ready_to_send: "founders",
  waiting: "outreach",
  negotiating: "outreach",
  setting_up: "onboarding",
  closed: "nobody",
};

const BY_STAGE: Partial<Record<Stage, LeadStatus>> = {
  preview_built: "ready_to_send",
  sent: "waiting",
  clicked: "waiting",
  replied: "negotiating",
  paid: "setting_up",
  lost: "closed",
  opted_out: "closed",
};

const BY_JOB: Record<PreviewJobStatus, LeadStatus> = {
  queued: "queued",
  claimed: "building",
  running: "building",
  waiting_for_usage: "queued",
  failed: "build_failed",
  done: "not_queued",
};

/** A new lead's status comes from its latest build; every later stage speaks for itself. */
export function leadStatus(stage: Stage, latestJob: PreviewJobStatus | null): LeadStatus {
  if (stage !== "new") return BY_STAGE[stage] ?? "closed";
  return latestJob ? BY_JOB[latestJob] : "not_queued";
}
