/**
 * Where a designer's business stands, and what they earn from it.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { monthlyFeeCents, noReply, owedCents, type WorkFacts, workStatus } from "./designerWork";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-18T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW - days * DAY);
const WAIT = 4;

function facts(extra: Partial<WorkFacts> = {}): WorkFacts {
  return { stage: "new", source: "lead_finder", paidAt: null, firstSentAt: null, followUpSentAt: null, repliedAt: null, clickedAt: null, previewUrl: "", board: "none", building: false, failed: false, awaitingReview: false, ...extra };
}

const status = (extra: Partial<WorkFacts>) => workStatus(facts(extra), WAIT, NOW);

test("before anything is sent, the status follows the design and the build", () => {
  assert.equal(status({ board: "waiting" }), "your_choice");
  assert.equal(status({ board: "redrawing", building: true }), "designing", "drawing new designs is designing, not building");
  assert.equal(status({ board: "chosen", building: true }), "building");
  assert.equal(status({ board: "chosen", failed: true }), "build_failed");
  assert.equal(status({ board: "chosen", previewUrl: "https://p.vercel.app", awaitingReview: true }), "your_review");
  assert.equal(status({ board: "chosen", previewUrl: "https://p.vercel.app", stage: "preview_built" }), "ready_to_send");
  assert.equal(status({ board: "chosen", stage: "lost" }), "set_aside", "a founder set it aside before any email");
});

test("once sent, the status follows the outreach", () => {
  const sent = { board: "chosen" as const, previewUrl: "https://p.vercel.app", stage: "sent" as const, firstSentAt: daysAgo(1) };
  assert.equal(status(sent), "sent");
  assert.equal(status({ ...sent, stage: "clicked", clickedAt: daysAgo(0) }), "clicked");
  assert.equal(status({ ...sent, stage: "replied", repliedAt: daysAgo(0) }), "replied");
  assert.equal(status({ ...sent, stage: "opted_out" }), "said_no");
  assert.equal(status({ ...sent, stage: "lost", repliedAt: daysAgo(0) }), "said_no", "they answered, then were marked lost");
  assert.equal(status({ ...sent, stage: "lost" }), "no_reply", "marked lost without ever answering");
  assert.equal(status({ ...sent, stage: "paid", paidAt: daysAgo(0) }), "client");
  assert.equal(status({ ...sent, stage: "live" }), "client");
});

test("no reply means every email we sent has had the follow-up wait, and a follow-up still due keeps it sent", () => {
  const first = { firstSentAt: daysAgo(30), followUpSentAt: null, repliedAt: null };
  assert.equal(noReply({ ...first, source: "lead_finder" }, WAIT, NOW), false, "its follow-up is still due");
  assert.equal(noReply({ ...first, source: "request" }, WAIT, NOW), true, "a business that asked us gets no follow-up");
  assert.equal(noReply({ ...first, source: "lead_finder", followUpSentAt: daysAgo(3) }, WAIT, NOW), false, "the follow-up's wait hasn't ended");
  assert.equal(noReply({ ...first, source: "lead_finder", followUpSentAt: daysAgo(4) }, WAIT, NOW), true);
  assert.equal(noReply({ ...first, source: "lead_finder", followUpSentAt: daysAgo(9), repliedAt: daysAgo(1) }, WAIT, NOW), false);
  assert.equal(status({ stage: "clicked", clickedAt: daysAgo(20), firstSentAt: daysAgo(30), followUpSentAt: daysAgo(20) }), "no_reply", "opening the preview is not a reply");
});

test("a month of the client's fee comes from their plan, or their price when a code made checkout free", () => {
  assert.equal(monthlyFeeCents("$59/month", 59), 5900);
  assert.equal(monthlyFeeCents("$79/month", null), 7900);
  assert.equal(monthlyFeeCents("$708/year", 59), 5900, "a yearly plan is a twelfth");
  assert.equal(monthlyFeeCents("$0/month", 59), 5900);
  assert.equal(monthlyFeeCents("", null), 7900, "no plan and no price arm is the regular price");
});

test("owed is everything earned less every payment, and can run ahead", () => {
  assert.equal(owedCents([{ cents: 5900 }, { cents: 7900 }], [{ amountCents: 5900 }]), 7900);
  assert.equal(owedCents([], [{ amountCents: 1000 }]), -1000);
  assert.equal(owedCents([], []), 0);
});
