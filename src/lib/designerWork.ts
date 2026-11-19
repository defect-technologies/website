// Student designers: where each business they took stands, told from its build, its review and its outreach, and
// what they earn from it. Designers see only these statuses, never the owner's contact details or the emails.

import { REGULAR_MONTHLY_PRICE } from "./emailTemplate";
import type { Stage } from "./stages";

/** Where a designer's area starts. */
export const DESIGNER_HOME = "/designer";

export const WORK_STATUSES = ["your_choice", "designing", "building", "build_failed", "your_review", "ready_to_send", "sent", "clicked", "replied", "no_reply", "said_no", "client", "cancelled", "set_aside"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  your_choice: "Waiting for your choice",
  designing: "New designs being drawn",
  building: "Building",
  build_failed: "Build failed",
  your_review: "Waiting for your review",
  ready_to_send: "Approved, not sent yet",
  sent: "Sent to the business",
  clicked: "Opened by the business",
  replied: "Replied",
  no_reply: "No reply",
  said_no: "Said no",
  client: "Signed up",
  cancelled: "Signed up, then cancelled",
  set_aside: "Set aside before sending",
};

/** Statuses that wait on the designer themself. */
export const THEIR_TURN: readonly WorkStatus[] = ["your_choice", "your_review"];

/** Statuses before the designer approved the build: their part is not done yet. */
export const UNFINISHED: readonly WorkStatus[] = ["your_choice", "designing", "building", "build_failed", "your_review"];

/** Where the business's newest design boards stand: waiting for a choice, drawn again, chosen, or none at all. */
export type BoardState = "waiting" | "redrawing" | "chosen" | "none";

export type WorkFacts = {
  stage: Stage;
  source: string;
  paidAt: Date | null;
  /** When the client cancelled their plan, or null while it runs. */
  cancelledAt: Date | null;
  firstSentAt: Date | null;
  followUpSentAt: Date | null;
  repliedAt: Date | null;
  clickedAt: Date | null;
  previewUrl: string;
  board: BoardState;
  /** A preview job is queued or running for the business. */
  building: boolean;
  /** Its latest preview job failed. */
  failed: boolean;
  /** Its preview is built and waits for a review. */
  awaitingReview: boolean;
};

const DAY_MS = 86_400_000;

/**
 * Whether the business has stopped answering. Each email we send gets the follow-up wait (Setup > Email template) for
 * a reply. A lead we found gets a follow-up when its first email's wait ends, so it has had no reply only once the
 * follow-up's wait has ended too. A business that asked us gets no follow-up, so its first email's wait is all.
 */
export function noReply(facts: Pick<WorkFacts, "source" | "firstSentAt" | "followUpSentAt" | "repliedAt">, followUpAfterDays: number, now: number): boolean {
  if (facts.repliedAt || !facts.firstSentAt) return false;
  const followUpDue = facts.source === "lead_finder" && !facts.followUpSentAt;
  const lastEmail = facts.followUpSentAt ?? facts.firstSentAt;
  return !followUpDue && now - lastEmail.getTime() >= followUpAfterDays * DAY_MS;
}

function outreachStatus(facts: WorkFacts, followUpAfterDays: number, now: number): WorkStatus {
  if (facts.stage === "opted_out" || (facts.stage === "lost" && facts.repliedAt)) return "said_no";
  if (facts.repliedAt) return "replied";
  if (facts.stage === "lost" || noReply(facts, followUpAfterDays, now)) return "no_reply";
  return facts.clickedAt ? "clicked" : "sent";
}

const BOARD_STATUS: Partial<Record<BoardState, WorkStatus>> = { waiting: "your_choice", redrawing: "designing" };

function buildStatus(facts: WorkFacts): WorkStatus {
  const fromBoard = BOARD_STATUS[facts.board];
  if (fromBoard) return fromBoard;
  if (facts.building) return "building";
  if (facts.failed) return "build_failed";
  if (facts.awaitingReview) return "your_review";
  return facts.previewUrl ? "ready_to_send" : "designing";
}

/** Statuses of a business that signed up for the design, which earn the designer one month of its fee. */
export const SIGNED_UP: readonly WorkStatus[] = ["client", "cancelled"];

/** Where a designer's design stands now, furthest along first: signed up, then the outreach, then the build. */
export function workStatus(facts: WorkFacts, followUpAfterDays: number, now = Date.now()): WorkStatus {
  if (facts.paidAt || facts.stage === "paid" || facts.stage === "live") return facts.cancelledAt ? "cancelled" : "client";
  if (facts.firstSentAt) return outreachStatus(facts, followUpAfterDays, now);
  if (facts.stage === "lost" || facts.stage === "opted_out") return "set_aside";
  return buildStatus(facts);
}

/**
 * One month of a client's fee, in cents: what a designer earns when a business they designed becomes a paying client.
 * The plan Stripe recorded says it ("$59/month", or "$708/year" as a twelfth). A checkout that a discount code made $0
 * records "$0/month", so then it is the monthly price the client signed up at: their price arm, else the regular price.
 */
export function monthlyFeeCents(plan: string, priceArm: number | null): number {
  const match = /^\$(\d+(?:\.\d+)?)\/(month|year)$/.exec(plan.trim());
  const amount = match ? Number(match[1]) : 0;
  if (amount > 0) return Math.round((match![2] === "year" ? amount / 12 : amount) * 100);
  return (priceArm ?? REGULAR_MONTHLY_PRICE) * 100;
}

/**
 * Which earnings the designer has been paid for. Payments go to the oldest earning first, and an earning counts as paid
 * once payments cover all of it.
 */
export function paidEarnings(earned: { businessId: string; paidAt: Date | null; cents: number }[], paid: { amountCents: number }[]): Set<string> {
  let left = paid.reduce((total, payment) => total + payment.amountCents, 0);
  const settled = new Set<string>();
  for (const earning of [...earned].sort((a, b) => (a.paidAt?.getTime() ?? 0) - (b.paidAt?.getTime() ?? 0))) {
    if (left < earning.cents) break;
    left -= earning.cents;
    settled.add(earning.businessId);
  }
  return settled;
}

/** What a designer is owed: everything they earned less every payment recorded. Below zero when they were paid ahead. */
export function owedCents(earned: { cents: number }[], paid: { amountCents: number }[]): number {
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  return sum(earned.map((entry) => entry.cents)) - sum(paid.map((payment) => payment.amountCents));
}
