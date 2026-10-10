import "server-only";
import { eq, inArray } from "drizzle-orm";
import { SENT_FROM_GMAIL } from "@/lib/senders";
import { record } from "../activity";
import { db } from "../db/client";
import { businesses, mailboxes, messages, type Business, type Mailbox } from "../db/schema";
import { advanceStage, updateBusiness } from "../leads/businesses";
import { mailSince, MailboxNeedsReconnect, type IncomingEmail } from "./gmail";
import { domainOf } from "./mime";
import { connectedMailboxes } from "./outbox";

const FIRST_SYNC_WINDOW = 14 * 24 * 60 * 60 * 1000;

/** Matching on these domains would tie every Gmail user to whichever lead happens to use Gmail. */
const SHARED_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "me.com",
  "aol.com", "comcast.net", "att.net", "sbcglobal.net", "verizon.net", "msn.com", "proton.me", "protonmail.com",
]);

const OPT_OUT_WORDS = /\b(no thanks|no thank you|unsubscribe|remove me|stop emailing|not interested)\b/i;

export function looksLikeOptOut(body: string) {
  return OPT_OUT_WORDS.test(body.slice(0, 400));
}

type Index = { byThread: Map<string, Business>; byEmail: Map<string, Business>; byDomain: Map<string, Business> };

function indexBusinesses(all: Business[], threads: { threadId: string | null; businessId: string }[]): Index {
  const byId = new Map(all.map((b) => [b.id, b]));
  const index: Index = { byThread: new Map(), byEmail: new Map(), byDomain: new Map() };
  for (const { threadId, businessId } of threads) {
    const business = byId.get(businessId);
    if (threadId && business) index.byThread.set(threadId, business);
  }
  for (const business of all) {
    for (const address of [business.email, business.ownerEmail].filter(Boolean)) index.byEmail.set(address.toLowerCase(), business);
    for (const domain of [domainOf(business.website), domainOf(business.email)]) {
      if (domain && !SHARED_MAIL_DOMAINS.has(domain)) index.byDomain.set(domain, business);
    }
  }
  return index;
}

/** Thread first, then the exact address, then its company domain. Unmatched mail is left alone. */
function matchBusiness(threadId: string, address: string, index: Index): Business | undefined {
  return index.byThread.get(threadId) ?? index.byEmail.get(address) ?? index.byDomain.get(domainOf(address));
}

async function store(mailbox: Mailbox, email: IncomingEmail, business: Business, direction: "in" | "out"): Promise<boolean> {
  const inserted = await (await db())
    .insert(messages)
    .values({
      businessId: business.id,
      mailboxId: mailbox.id,
      direction,
      kind: direction === "in" ? "inbound" : "reply",
      gmailId: email.gmailId,
      threadId: email.threadId,
      headerMessageId: email.headerMessageId,
      fromAddress: email.from,
      toAddress: email.to,
      subject: email.subject,
      body: email.body,
      sentBy: direction === "out" ? SENT_FROM_GMAIL : "",
      at: email.at,
    })
    .onConflictDoNothing()
    .returning({ id: messages.id });
  return inserted.length > 0;
}

async function noteReply(business: Business, email: IncomingEmail) {
  await updateBusiness(business.id, { repliedAt: business.repliedAt ?? email.at, lastContactAt: email.at });
  await advanceStage(business.id, "replied");
  const detail = looksLikeOptOut(email.body) ? "looks like an opt-out" : email.from;
  await record("mail sync", "reply received", { businessId: business.id, detail });
}

async function syncInbox(mailbox: Mailbox, index: Index): Promise<number> {
  const since = mailbox.lastSyncedAt ?? new Date(Date.now() - FIRST_SYNC_WINDOW);
  const startedAt = new Date();
  const incoming = (await mailSince(mailbox, "inbox", since)).filter((email) => email.from !== mailbox.email);
  let stored = 0;
  for (const email of incoming) {
    const business = matchBusiness(email.threadId, email.from, index);
    if (!business || !(await store(mailbox, email, business, "in"))) continue;
    await noteReply(business, email);
    stored += 1;
  }
  await (await db()).update(mailboxes).set({ lastSyncedAt: startedAt, lastError: "" }).where(eq(mailboxes.id, mailbox.id));
  return stored;
}

async function noteSent(business: Business, email: IncomingEmail) {
  if (!business.lastContactAt || business.lastContactAt < email.at) await updateBusiness(business.id, { lastContactAt: email.at });
  await record("mail sync", "saw an email sent from Gmail", { businessId: business.id, detail: email.to });
}

/** Mail the admin sent is already stored under its Gmail ID, so only mail sent from Gmail directly is new here. */
async function syncSent(mailbox: Mailbox, index: Index): Promise<number> {
  const since = mailbox.lastSentSyncedAt ?? new Date(Date.now() - FIRST_SYNC_WINDOW);
  const startedAt = new Date();
  let stored = 0;
  for (const email of await mailSince(mailbox, "sent", since)) {
    const business = matchBusiness(email.threadId, email.to, index);
    if (!business || !(await store(mailbox, email, business, "out"))) continue;
    await noteSent(business, email);
    stored += 1;
  }
  await (await db()).update(mailboxes).set({ lastSentSyncedAt: startedAt }).where(eq(mailboxes.id, mailbox.id));
  return stored;
}

async function failMailbox(mailbox: Mailbox, error: unknown) {
  const message = error instanceof MailboxNeedsReconnect ? `${(error as Error).message} Reconnect it.` : (error as Error).message;
  await (await db()).update(mailboxes).set({ lastError: message }).where(eq(mailboxes.id, mailbox.id));
}

export type MailSyncResult = { mailboxes: number; newMessages: number; errors: string[] };

const REPLYING_STAGES: Business["stage"][] = ["sent", "clicked", "replied", "paid", "live"];

/** Mail we send can go to a lead before its first tracked email, so Sent also matches leads with a built preview. */
const EMAILED_STAGES: Business["stage"][] = ["preview_built", ...REPLYING_STAGES];

async function syncMailbox(mailbox: Mailbox, inbound: Index, outbound: Index): Promise<number> {
  return (await syncInbox(mailbox, inbound)) + (await syncSent(mailbox, outbound));
}

export async function syncMail(): Promise<MailSyncResult> {
  const all = await connectedMailboxes();
  const database = await db();
  const [leads, threads] = await Promise.all([
    database.select().from(businesses).where(inArray(businesses.stage, EMAILED_STAGES)),
    database.selectDistinct({ threadId: messages.threadId, businessId: messages.businessId }).from(messages),
  ]);
  const inbound = indexBusinesses(
    leads.filter((lead) => REPLYING_STAGES.includes(lead.stage)),
    threads,
  );
  const outbound = indexBusinesses(leads, threads);
  const result: MailSyncResult = { mailboxes: all.length, newMessages: 0, errors: [] };
  for (const mailbox of all) {
    try {
      result.newMessages += await syncMailbox(mailbox, inbound, outbound);
    } catch (error) {
      await failMailbox(mailbox, error);
      result.errors.push(`${mailbox.email}: ${(error as Error).message}`);
    }
  }
  return result;
}
