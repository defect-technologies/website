import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { record } from "../activity";
import { db } from "../db/client";
import { messages, type BotKey, type Business, type Message } from "../db/schema";
import { updateBusiness } from "../leads/businesses";
import { deliver } from "../mail/outbox";
import type { OutgoingEmail } from "../mail/mime";
import { TEAM_SIGNATURE_TEXT, withSignerHtml, withTeamSignatureHtml } from "../mail/teamSignature";
import { outreachSettings } from "../settings";
import type { Mailbox } from "../db/schema";
import { STUDIO_NAME, studioMailboxId } from "../onboarding/welcome";
import { replySubject, unwrapLinks, withoutSubjectLine } from "@/lib/emailLinks";
import { actorOf, BotError } from "./http";
import { ownedLead } from "./leads";

export const ReplyBody = z.object({ body: z.string().trim().min(1).max(10_000) });

const RAW_PREVIEW = /https?:\/\/[a-z0-9-]+\.vercel\.app\S*/i;

function checkBody(body: string) {
  if (RAW_PREVIEW.test(body)) throw new BotError(422, "The email links a raw vercel.app address. Use the previewLink or siteUrl from the admin API instead.");
  if (/urldefense\.(?:com|proofpoint\.com)/i.test(body)) throw new BotError(422, "The email has a urldefense link copied from another email. Use links from the admin API.");
}

/** The lead's latest message from them in a thread (in this inbox, when one is given), or our latest if they haven't written. */
async function threadToAnswer(lead: Business, mailboxId: string | null = null): Promise<Message> {
  const database = await db();
  const inThread = and(eq(messages.businessId, lead.id), isNotNull(messages.threadId), mailboxId ? eq(messages.mailboxId, mailboxId) : undefined);
  const [inbound] = await database.select().from(messages).where(and(inThread, eq(messages.direction, "in"))).orderBy(desc(messages.at)).limit(1);
  if (inbound) return inbound;
  const [latest] = await database.select().from(messages).where(inThread).orderBy(desc(messages.at)).limit(1);
  if (latest) return latest;
  if (mailboxId) return threadToAnswer(lead);
  throw new BotError(409, "This lead has no email thread to reply to yet.");
}

function recipientOf(message: Message, lead: Business): string {
  if (message.direction === "in") return message.fromAddress;
  return message.toAddress || lead.ownerEmail || lead.email;
}

/** HTML with the graphic signature when the body ends with the team's sign-off; plain text alone otherwise. */
function htmlFor(body: string): string | undefined {
  const lines = body.trimEnd().split("\n").map((line) => line.trim());
  const endsWithSignature = TEAM_SIGNATURE_TEXT.every((line, index) => lines[lines.length - TEAM_SIGNATURE_TEXT.length + index] === line);
  return endsWithSignature ? withTeamSignatureHtml(body) : undefined;
}

type Reply = { to: string; subject: string; body: string; answering: Message };
type Sender = { mailboxId: string | null; compose: (from: Mailbox | null, reply: Reply) => OutgoingEmail };

function threaded(from: Mailbox | null, name: string, reply: Reply): OutgoingEmail {
  const { to, subject, body, answering } = reply;
  return { from: { name, email: from?.email ?? "outbox@dev.localhost" }, to, subject, body, threadId: answering.threadId, inReplyTo: answering.headerMessageId || null };
}

/** Clients hear from hello@defect.tech as the team. */
async function studioSender(): Promise<Sender> {
  return { mailboxId: await studioMailboxId(), compose: (from, reply) => ({ ...threaded(from, STUDIO_NAME, reply), html: htmlFor(reply.body) }) };
}

/** Prospects hear from the cold inbox their thread is on, as the founder, with the cold signature and a way out. */
async function outreachSender(lead: Business, answering: Message): Promise<Sender> {
  const mailboxId = answering.mailboxId ?? lead.mailboxId;
  // Never let a prospect's reply fall back to hello@defect.tech, which only clients hear from.
  if (!mailboxId) throw new BotError(409, "This prospect's thread isn't on a cold inbox the admin knows. Reply with the Gmail tool this once and flag it.");
  const { senderName } = await outreachSettings();
  return {
    mailboxId,
    compose: (from, reply) => {
      const email = threaded(from, senderName, reply);
      return { ...email, html: withSignerHtml(reply.body, { name: senderName, line: "Defect Technologies", email: email.from.email }) ?? undefined, listUnsubscribe: true };
    },
  };
}

const SENDERS: Record<string, (lead: Business, answering: Message) => Promise<Sender>> = {
  onboarding: studioSender,
  client_care: studioSender,
  outreach: outreachSender,
};

/**
 * POST /leads/:id/reply: sends the bot's reply in the lead's own thread. Links come out
 * unwrapped and the subject gets a single "Re:", whatever the bot pasted.
 */
export async function replyToLead(key: BotKey, id: string, input: z.infer<typeof ReplyBody>) {
  const senderFor = SENDERS[key.bot];
  if (!senderFor) throw new BotError(403, "Only Outreach, Onboarding and Client care send email.");
  const lead = await ownedLead(key, id);
  const { text: body, unwrapped } = unwrapLinks(withoutSubjectLine(input.body));
  checkBody(body);
  const answering = await threadToAnswer(lead, key.bot === "outreach" ? lead.mailboxId : null);
  const to = recipientOf(answering, lead);
  const subject = replySubject(answering.subject);
  const sender = await senderFor(lead, answering);
  const delivery = await deliver((from) => sender.compose(from, { to, subject, body, answering }), sender.mailboxId);
  await (await db()).insert(messages).values({
    businessId: lead.id,
    mailboxId: delivery.mailbox?.id ?? null,
    direction: "out",
    kind: "reply",
    gmailId: delivery.gmailId,
    threadId: delivery.threadId,
    headerMessageId: delivery.headerMessageId,
    fromAddress: delivery.email.from.email,
    toAddress: to,
    subject,
    body,
    sentBy: actorOf(key),
  });
  await updateBusiness(lead.id, { lastContactAt: new Date() });
  await record(actorOf(key), "replied", { businessId: lead.id, detail: `${subject} → ${to}${unwrapped ? ` (unwrapped ${unwrapped} link${unwrapped === 1 ? "" : "s"})` : ""}` });
  return { ok: true, to, subject, unwrappedLinks: unwrapped };
}
