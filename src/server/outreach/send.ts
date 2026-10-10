import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { record } from "../activity";
import type { Founder } from "../auth/session";
import { db } from "../db/client";
import { businesses, messages, type Business, type Mailbox } from "../db/schema";
import { advanceStage, blockedDomains, businessById, updateBusiness } from "../leads/businesses";
import { deliver } from "../mail/outbox";
import type { OutgoingEmail } from "../mail/mime";
import { withSignerHtml } from "../mail/teamSignature";
import { outreachSettings } from "../settings";
import { blockers, composeBody, composeSubject, type EmailKind } from "./compose";
import { sentToday } from "./queue";

export type SendResult = { ok: true; to: string } | { ok: false; error: string };

const CLAIM_COLUMN = { first: businesses.firstSentAt, follow_up: businesses.followUpSentAt } as const;
const CLAIM_FIELD = { first: "firstSentAt", follow_up: "followUpSentAt" } as const;

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

type Prepared = { business: Business; subject: string; body: string };

async function prepare(kind: EmailKind, id: string, problem?: string): Promise<Prepared | string> {
  const [business, settings, blocked, sent] = await Promise.all([businessById(id), outreachSettings(), blockedDomains(), sentToday()]);
  if (!business) return "That business no longer exists.";
  if (sent >= settings.dailyLimit) return `You've sent today's ${settings.dailyLimit}. Raise the limit on the Template page, or send tomorrow.`;
  const body = composeBody(kind, business, settings, problem);
  const problems = blockers(business, settings, blocked, body);
  if (problems.length > 0) return problems[0];
  return { business, subject: composeSubject(kind, business, settings, await firstSubject(business)), body };
}

function outgoing(kind: EmailKind, { business, subject, body }: Prepared, from: Mailbox | null, senderName: string): OutgoingEmail {
  const email = from?.email ?? "outbox@dev.localhost";
  return {
    from: { name: senderName, email },
    to: business.email,
    subject,
    body,
    html: withSignerHtml(body, { name: senderName, line: "Defect Technologies", email }) ?? undefined,
    threadId: kind === "follow_up" ? business.threadId : null,
    inReplyTo: kind === "follow_up" ? business.firstMessageHeaderId : null,
    listUnsubscribe: true,
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
  const firstFields = kind === "first" ? { threadId: delivery.threadId, firstMessageHeaderId: delivery.headerMessageId, mailboxId: delivery.mailbox?.id ?? null } : {};
  const problemField = problem ? { emailProblem: problem } : {};
  await updateBusiness(business.id, { ...firstFields, ...problemField, lastContactAt: now });
  await advanceStage(business.id, "sent");
  await record(founder.email, kind === "first" ? "sent first email" : "sent follow-up", { businessId: business.id, detail: business.email });
}

export async function sendOutreach(kind: EmailKind, id: string, founder: Founder, problem?: string): Promise<SendResult> {
  const prepared = await prepare(kind, id, problem);
  if (typeof prepared === "string") return { ok: false, error: prepared };
  if (!(await claim(kind, id))) return { ok: false, error: "This one already went out. The queue was out of date." };
  const { senderName } = await outreachSettings();
  try {
    const delivery = await deliver((from) => outgoing(kind, prepared, from, senderName), prepared.business.mailboxId);
    await remember(kind, prepared, delivery, founder, problem);
    return { ok: true, to: prepared.business.email };
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
