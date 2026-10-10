import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { record } from "../activity";
import { db } from "../db/client";
import { messages, type BotKey, type Business, type Message } from "../db/schema";
import { updateBusiness } from "../leads/businesses";
import { deliver } from "../mail/outbox";
import { TEAM_SIGNATURE_TEXT, withTeamSignatureHtml } from "../mail/teamSignature";
import { STUDIO_NAME, studioMailboxId } from "../onboarding/welcome";
import { replySubject, unwrapLinks } from "@/lib/emailLinks";
import { actorOf, BotError } from "./http";
import { ownedLead } from "./leads";

export const ReplyBody = z.object({ body: z.string().trim().min(1).max(10_000) });

const RAW_PREVIEW = /https?:\/\/[a-z0-9-]+\.vercel\.app\S*/i;

function checkBody(body: string) {
  if (RAW_PREVIEW.test(body)) throw new BotError(422, "The email links a raw vercel.app address. Use the previewLink or siteUrl from the admin API instead.");
  if (/urldefense\.(?:com|proofpoint\.com)/i.test(body)) throw new BotError(422, "The email has a urldefense link copied from another email. Use links from the admin API.");
}

/** The client's latest message in a thread, or our latest if they haven't written in one. */
async function threadToAnswer(lead: Business): Promise<Message> {
  const database = await db();
  const inThread = and(eq(messages.businessId, lead.id), isNotNull(messages.threadId));
  const [inbound] = await database.select().from(messages).where(and(inThread, eq(messages.direction, "in"))).orderBy(desc(messages.at)).limit(1);
  if (inbound) return inbound;
  const [latest] = await database.select().from(messages).where(inThread).orderBy(desc(messages.at)).limit(1);
  if (!latest) throw new BotError(409, "This lead has no email thread to reply to yet.");
  return latest;
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

/**
 * POST /leads/:id/reply: sends the bot's reply from hello@defect.tech in the client's thread.
 * Links come out unwrapped and the subject gets a single "Re:", whatever the bot pasted.
 */
export async function replyToLead(key: BotKey, id: string, input: z.infer<typeof ReplyBody>) {
  if (!["onboarding", "client_care"].includes(key.bot)) throw new BotError(403, "Only Onboarding and Client care send through the admin.");
  const lead = await ownedLead(key, id);
  const { text: body, unwrapped } = unwrapLinks(input.body);
  checkBody(body);
  const answering = await threadToAnswer(lead);
  const to = recipientOf(answering, lead);
  const subject = replySubject(answering.subject);
  const delivery = await deliver(
    (from) => ({ from: { name: STUDIO_NAME, email: from?.email ?? "outbox@dev.localhost" }, to, subject, body, html: htmlFor(body), threadId: answering.threadId, inReplyTo: answering.headerMessageId || null }),
    await studioMailboxId(),
  );
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
