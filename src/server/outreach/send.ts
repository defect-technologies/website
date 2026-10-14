import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { record } from "../activity";
import type { Founder } from "../auth/session";
import { db } from "../db/client";
import { businesses, messages, type Business, type Mailbox } from "../db/schema";
import { advanceStage, blockedContacts, businessById, updateBusiness } from "../leads/businesses";
import { isBlocked } from "../leads/contactKeys";
import { deliver } from "../mail/outbox";
import type { OutgoingEmail } from "../mail/mime";
import { htmlFor } from "../bots/reply";
import { requestThreads } from "../inbound/threads";
import { STUDIO_NAME, studioMailboxId } from "../onboarding/welcome";
import { outreachSettings } from "../settings";
import { blockers, composeBody, composeSubject, type EmailKind, type RequestThread } from "./compose";
import { sentToday } from "./queue";

export type SendResult = { ok: true; to: string } | { ok: false; error: string };

export type Recipients = { to: string[]; cc: string[]; bcc: string[] };

/** The email as the founder rewrote it on the queue card, sent in place of the template. */
export type EmailEdits = Recipients & { subject: string; body: string };

const everyone = ({ to, cc, bcc }: Recipients) => [...to, ...cc, ...bcc];

const CLAIM_COLUMN = { first: businesses.firstSentAt, follow_up: businesses.followUpSentAt, requested: businesses.firstSentAt } as const;
const CLAIM_FIELD = { first: "firstSentAt", follow_up: "followUpSentAt", requested: "firstSentAt" } as const;
const isCold = (kind: EmailKind) => kind !== "requested";

/** Marks the email as going out in one statement, so a double click or both founders at once can't send it twice. */
async function claim(kind: EmailKind, id: string): Promise<boolean> {
  const column = CLAIM_COLUMN[kind];
  const claimed = await (await db())
    .update(businesses)
    .set({ [CLAIM_FIELD[kind]]: new Date() })
    .where(and(eq(businesses.id, id), isNull(column)))
    .returning({ id: businesses.id });
  return claimed.length > 0;
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

async function prepare(kind: EmailKind, id: string, problem?: string, edits?: EmailEdits): Promise<Prepared | string> {
  const [stored, settings, blocked, sent] = await Promise.all([businessById(id), outreachSettings(), blockedContacts(), sentToday()]);
  if (!stored) return "That business no longer exists.";
  if (isCold(kind) && sent >= settings.dailyLimit) return `You've sent today's ${settings.dailyLimit}. Raise the limit in Setup > Email template, or send tomorrow.`;
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
  });
  const firstFields = kind !== "follow_up" ? { threadId: delivery.threadId, firstMessageHeaderId: delivery.headerMessageId, mailboxId: delivery.mailbox?.id ?? null } : {};
  const problemField = problem ? { emailProblem: problem } : {};
  await updateBusiness(business.id, { ...firstFields, ...problemField, email: business.email, emailDraft: null, lastContactAt: now });
  await advanceStage(business.id, "sent");
  await record(founder.email, SENT_ACTION[kind], { businessId: business.id, detail: everyone(prepared.recipients).join(", ") });
}

const SENT_ACTION: Record<EmailKind, string> = { first: "sent first email", follow_up: "sent follow-up", requested: "sent the preview they asked for" };

const mailboxFor = async (kind: EmailKind, business: Business) => (isCold(kind) ? business.mailboxId : await studioMailboxId());

export async function sendOutreach(kind: EmailKind, id: string, founder: Founder, problem?: string, edits?: EmailEdits): Promise<SendResult> {
  const prepared = await prepare(kind, id, problem, edits);
  if (typeof prepared === "string") return { ok: false, error: prepared };
  if (!(await claim(kind, id))) return { ok: false, error: "This one already went out. The queue was out of date." };
  const { senderName } = await outreachSettings();
  try {
    const delivery = await deliver((from) => outgoing(kind, prepared, from, senderName), await mailboxFor(kind, prepared.business));
    await remember(kind, prepared, delivery, founder, problem);
    return { ok: true, to: prepared.recipients.to.join(", ") };
  } catch (error) {
    await release(kind, id);
    return { ok: false, error: `Nothing was sent. ${(error as Error).message}` };
  }
}

/** Sets a lead aside without emailing it. It stays in the pipeline as lost and can be moved back. */
export async function skipLead(business: Business, founder: Founder, reason: string) {
  const id = business.id;
  await updateBusiness(id, { stage: "lost", note: [business.note, reason].filter(Boolean).join("\n") });
  await record(founder.email, "skipped", { businessId: id, detail: reason });
}
