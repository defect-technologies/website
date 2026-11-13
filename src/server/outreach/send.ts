import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { record } from "../activity";
import type { Founder } from "../auth/session";
import { db } from "../db/client";
import { businesses, messages, type Business, type Mailbox } from "../db/schema";
import { advanceStage, blockedContacts, businessById, updateBusiness } from "../leads/businesses";
import { isBlocked } from "../leads/contactKeys";
import { SendOutcomeUnknown } from "../mail/gmail";
import { deliver } from "../mail/outbox";
import type { OutgoingEmail } from "../mail/mime";
import { htmlFor } from "../bots/reply";
import { requestThreads } from "../inbound/threads";
import { STUDIO_NAME, studioMailboxId } from "../onboarding/welcome";
import { outreachSettings } from "../settings";
import { blockers, composeBody, composeSubject, type EmailKind, type RequestThread } from "./compose";
import { PACIFIC_MIDNIGHT } from "./pacificDay";
import { sentToday } from "./queue";

export type SendResult = { ok: true; to: string } | { ok: false; error: string };

export type Recipients = { to: string[]; cc: string[]; bcc: string[] };

/** The email as the founder rewrote it on the queue card, sent in place of the template. */
export type EmailEdits = Recipients & { subject: string; body: string };

const everyone = ({ to, cc, bcc }: Recipients) => [...to, ...cc, ...bcc];

const CLAIM_COLUMN = { first: businesses.firstSentAt, follow_up: businesses.followUpSentAt, requested: businesses.firstSentAt } as const;
const CLAIM_FIELD = { first: "firstSentAt", follow_up: "followUpSentAt", requested: "firstSentAt" } as const;
const isCold = (kind: EmailKind) => kind !== "requested";

type Claim = "claimed" | "taken" | "capped";

/** Cold emails sent today, plus those claimed today whose message is not saved yet, so a send in flight counts. */
const coldEmailsToday = sql`(
  (select count(*) from messages where direction = 'out' and kind in ('first', 'follow_up') and at >= ${PACIFIC_MIDNIGHT})
  + (select count(*) from businesses b where b.source <> 'request' and (
      (b.first_sent_at >= ${PACIFIC_MIDNIGHT} and not exists (select 1 from messages m where m.business_id = b.id and m.kind = 'first'))
      or (b.follow_up_sent_at >= ${PACIFIC_MIDNIGHT} and not exists (select 1 from messages m where m.business_id = b.id and m.kind = 'follow_up'))))
)`;

/**
 * Marks the email as going out in one statement, so a double click or both founders at once can't send it twice.
 * A cold email is claimed under a lock that also counts the day's sends, so two founders can't both take the last one.
 */
async function claim(kind: EmailKind, id: string, dailyLimit: number): Promise<Claim> {
  const column = CLAIM_COLUMN[kind];
  const claimOne = (database: Pick<Awaited<ReturnType<typeof db>>, "update">, withinLimit = sql`true`) =>
    database
      .update(businesses)
      .set({ [CLAIM_FIELD[kind]]: new Date() })
      .where(and(eq(businesses.id, id), isNull(column), withinLimit))
      .returning({ id: businesses.id });
  if (!isCold(kind)) return (await claimOne(await db())).length > 0 ? "claimed" : "taken";
  return (await db()).transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext('cold-send-cap'))`);
    if ((await claimOne(transaction, sql`${coldEmailsToday} < ${dailyLimit}`)).length > 0) return "claimed";
    const [open] = await transaction.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.id, id), isNull(column)));
    return open ? "capped" : "taken";
  });
}

async function release(kind: EmailKind, id: string) {
  await updateBusiness(id, { [CLAIM_FIELD[kind]]: null });
}

async function firstSubject(business: Business) {
  const [first] = await (await db())
    .select({ subject: messages.subject })
    .from(messages)
    .where(and(eq(messages.businessId, business.id), eq(messages.kind, "first")));
  return first?.subject ?? "";
}

type Prepared = { business: Business; recipients: Recipients; subject: string; body: string; thread: RequestThread | null };

function optedOutRecipient(edits: EmailEdits | undefined, blocked: Set<string>) {
  const address = edits && everyone(edits).find((email) => isBlocked(blocked, { email }));
  return address ? `${address} opted out, so it can't be emailed.` : null;
}

const dailyLimitReached = (limit: number) => `You've sent today's ${limit}. Raise the limit in Setup > Email template, or send tomorrow.`;

async function prepare(kind: EmailKind, id: string, problem?: string, edits?: EmailEdits): Promise<Prepared | string> {
  const [stored, settings, blocked, sent] = await Promise.all([businessById(id), outreachSettings(), blockedContacts(), sentToday()]);
  if (!stored) return "That business no longer exists.";
  if (isCold(kind) && sent >= settings.dailyLimit) return dailyLimitReached(settings.dailyLimit);
  const optedOut = optedOutRecipient(edits, blocked);
  if (optedOut) return optedOut;
  const business = edits ? { ...stored, email: edits.to[0] } : stored;
  const body = edits?.body ?? composeBody(kind, business, settings, problem);
  const problems = blockers(business, settings, blocked, body, { kind, edited: Boolean(edits) });
  if (problems.length > 0) return problems[0];
  const thread = kind === "requested" ? ((await requestThreads([business.id])).get(business.id) ?? null) : null;
  const subject = edits?.subject ?? composeSubject(kind, business, settings, await firstSubject(business), thread);
  const recipients = edits ? { to: edits.to, cc: edits.cc, bcc: edits.bcc } : { to: [business.email], cc: [], bcc: [] };
  return { business, recipients, subject, body, thread };
}

/** A business that asked us hears from hello@defect.tech as the team, in the thread they asked in. */
const addressed = ({ to, cc, bcc }: Recipients) => ({ to: to.join(", "), cc, bcc });

function requestedEmail({ recipients, subject, body, thread }: Prepared, from: Mailbox | null): OutgoingEmail {
  return {
    from: { name: STUDIO_NAME, email: from?.email ?? "outbox@dev.localhost" },
    ...addressed(recipients),
    subject,
    body,
    html: htmlFor(body),
    threadId: thread?.threadId ?? null,
    inReplyTo: thread?.headerMessageId || null,
  };
}

/**
 * Cold email goes out as plain text from one person: no HTML, images or List-Unsubscribe header,
 * which spam filters read as a mailing from a new domain. The opt-out stays in the body.
 */
function outgoing(kind: EmailKind, prepared: Prepared, from: Mailbox | null, senderName: string): OutgoingEmail {
  if (kind === "requested") return requestedEmail(prepared, from);
  const { business, recipients, subject, body } = prepared;
  return {
    from: { name: senderName, email: from?.email ?? "outbox@dev.localhost" },
    ...addressed(recipients),
    subject,
    body,
    threadId: kind === "follow_up" ? business.threadId : null,
    inReplyTo: kind === "follow_up" ? business.firstMessageHeaderId : null,
  };
}

async function remember(kind: EmailKind, prepared: Prepared, delivery: Awaited<ReturnType<typeof deliver>>, founder: Founder, problem?: string) {
  const { business } = prepared;
  const now = new Date();
  await (await db()).insert(messages).values({
    businessId: business.id,
    mailboxId: delivery.mailbox?.id ?? null,
    direction: "out",
    kind,
    gmailId: delivery.gmailId,
    threadId: delivery.threadId,
    headerMessageId: delivery.headerMessageId,
    fromAddress: delivery.email.from.email,
    toAddress: delivery.email.to,
    subject: delivery.email.subject,
    body: delivery.email.body,
    sentBy: founder.email,
  }).onConflictDoNothing();
  const firstFields = kind !== "follow_up" ? { threadId: delivery.threadId, firstMessageHeaderId: delivery.headerMessageId, mailboxId: delivery.mailbox?.id ?? null } : {};
  const problemField = problem ? { emailProblem: problem } : {};
  await updateBusiness(business.id, { ...firstFields, ...problemField, email: business.email, emailDraft: null, lastContactAt: now });
  await advanceStage(business.id, "sent");
  await record(founder.email, SENT_ACTION[kind], { businessId: business.id, detail: everyone(prepared.recipients).join(", ") });
}

const SENT_ACTION: Record<EmailKind, string> = { first: "sent first email", follow_up: "sent follow-up", requested: "sent the preview they asked for" };

const mailboxFor = async (kind: EmailKind, business: Business) => (isCold(kind) ? business.mailboxId : await studioMailboxId());

type Delivered = Awaited<ReturnType<typeof deliver>>;

/** Opens the claim again only when Gmail certainly did not take the email. After a send with no answer it stays closed. */
async function deliverOrRelease(kind: EmailKind, prepared: Prepared, senderName: string): Promise<Delivered | SendResult> {
  try {
    return await deliver((from) => outgoing(kind, prepared, from, senderName), await mailboxFor(kind, prepared.business));
  } catch (error) {
    if (error instanceof SendOutcomeUnknown) return { ok: false, error: `${error.message} Look in Sent in Gmail before sending it again.` };
    await release(kind, prepared.business.id);
    return { ok: false, error: `Nothing was sent. ${(error as Error).message}` };
  }
}

const RECORD_ATTEMPTS = 2;

/** Gmail has the email by now, so a failed save must never undo the claim. The sync stores the message by its Gmail ID later. */
async function rememberAfterSend(kind: EmailKind, prepared: Prepared, delivery: Delivered, founder: Founder, problem?: string) {
  let failure: unknown;
  for (let attempt = 0; attempt < RECORD_ATTEMPTS; attempt += 1) {
    try {
      return await remember(kind, prepared, delivery, founder, problem);
    } catch (error) {
      failure = error;
    }
  }
  const id = prepared.business.id;
  await advanceStage(id, "sent").catch((error) => console.error("[send] stage after a sent email", error));
  await record(founder.email, "sent an email but could not save it", { businessId: id, detail: `Gmail ID ${delivery.gmailId}: ${(failure as Error).message}` }).catch((error) =>
    console.error("[send] note after a sent email", error),
  );
}

export async function sendOutreach(kind: EmailKind, id: string, founder: Founder, problem?: string, edits?: EmailEdits): Promise<SendResult> {
  const prepared = await prepare(kind, id, problem, edits);
  if (typeof prepared === "string") return { ok: false, error: prepared };
  const { senderName, dailyLimit } = await outreachSettings();
  const claimed = await claim(kind, id, dailyLimit);
  if (claimed === "capped") return { ok: false, error: dailyLimitReached(dailyLimit) };
  if (claimed === "taken") return { ok: false, error: "This one already went out. The queue was out of date." };
  const delivery = await deliverOrRelease(kind, prepared, senderName);
  if ("ok" in delivery) return delivery;
  await rememberAfterSend(kind, prepared, delivery, founder, problem);
  return { ok: true, to: prepared.recipients.to.join(", ") };
}

/** Sets a lead aside without emailing it. It stays in the pipeline as lost and can be moved back. */
export async function skipLead(business: Business, founder: Founder, reason: string) {
  const id = business.id;
  await updateBusiness(id, { stage: "lost", note: [business.note, reason].filter(Boolean).join("\n") });
  await record(founder.email, "skipped", { businessId: id, detail: reason });
}

/** A skipped lead goes back to the stage that keeps it in the queue it came from. */
export async function unskipLead(business: Business, founder: Founder) {
  const stage = business.firstSentAt ? (business.clickedAt ? "clicked" : "sent") : "preview_built";
  await updateBusiness(business.id, { stage });
  await record(founder.email, "put back in the queue", { businessId: business.id });
}
