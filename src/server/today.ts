import "server-only";
import { cache } from "react";
import { monthOf, todayInPacific, type MonthBalance } from "@/lib/settleUp";
import { openFlags, resolvedFlags } from "./bots/flags";
import { balances } from "./expenses/expenses";
import { leadMatcher, openOfKinds, pastRequests } from "./inbound/requests";
import { threadSummaries } from "./mail/threads";
import { outreachQueue } from "./outreach/queue";
import { openSpotChecks } from "./spotChecks";

/** The layout's badges and the Today page both read these in one request; React's cache runs each once. */
const queue = cache(outreachQueue);
const months = cache(async () => (await balances()).months);
const flagsOpen = cache(openFlags);
const spotChecksOpen = cache(openSpotChecks);
const founderMail = cache(() => openOfKinds(["request", "founder", "unsorted"]));
const threads = cache(threadSummaries);

/** A finished month where one founder still owes the other. */
function settleDue(all: MonthBalance[]): MonthBalance[] {
  const thisMonth = monthOf(todayInPacific());
  return all.filter((balance) => balance.owed && balance.month < thisMonth);
}

/** Everything that waits on a founder, most urgent first. */
export async function today() {
  const [flags, inbound, sendQueue, spotChecks, monthRows, threadRows, match, resolved, past, answering] = await Promise.all([
    flagsOpen(),
    founderMail(),
    queue(),
    spotChecksOpen(),
    months(),
    threads(),
    leadMatcher(),
    resolvedFlags(),
    pastRequests(30),
    openOfKinds(["bot"]),
  ]);
  return {
    flags,
    requests: inbound.filter((row) => row.kind === "request"),
    founderEmails: inbound.filter((row) => row.kind === "founder"),
    unsorted: inbound.filter((row) => row.kind === "unsorted"),
    answering,
    queue: sendQueue,
    spotChecks,
    settle: settleDue(monthRows),
    replies: threadRows.filter((thread) => thread.unread > 0),
    match,
    resolved,
    past,
    readAt: Date.now(),
  };
}

/** The nav's badges. Today counts what a founder has to do; Messages counts what they haven't read. */
export async function navCounts() {
  const [flags, inbound, sendQueue, spotChecks, monthRows, threadRows] = await Promise.all([flagsOpen(), founderMail(), queue(), spotChecksOpen(), months(), threads()]);
  const sendable = [...sendQueue.requested, ...sendQueue.followUps, ...sendQueue.firstEmails].filter((item) => item.blockers.length === 0).length;
  return {
    today: flags.length + inbound.length + sendable + spotChecks.length + settleDue(monthRows).length,
    messages: threadRows.reduce((total, thread) => total + thread.unread, 0),
  };
}
