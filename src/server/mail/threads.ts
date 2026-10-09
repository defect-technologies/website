import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { record } from "../activity";
import type { Founder } from "../auth/session";
import { db } from "../db/client";
import { businesses, messages, type Business, type Message } from "../db/schema";
import { businessById, updateBusiness } from "../leads/businesses";
import { deliver } from "./outbox";

export type ThreadSummary = {
  business: Pick<Business, "id" | "businessName" | "email" | "stage" | "priceArm">;
  lastAt: Date;
  lastDirection: "out" | "in";
  lastBody: string;
  unread: number;
};

/** One row per business that has any mail, newest conversation first. */
export async function threadSummaries(): Promise<ThreadSummary[]> {
  const database = await db();
  const latest = database
    .selectDistinctOn([messages.businessId], {
      businessId: messages.businessId,
      at: messages.at,
      direction: messages.direction,
      body: messages.body,
    })
    .from(messages)
    .orderBy(messages.businessId, desc(messages.at))
    .as("latest");
  const unread = database
    .select({ businessId: messages.businessId, count: sql<number>`count(*)::int`.as("count") })
    .from(messages)
    .where(and(eq(messages.direction, "in"), isNull(messages.readAt)))
    .groupBy(messages.businessId)
    .as("unread");
  const rows = await database
    .select({
      id: businesses.id,
      businessName: businesses.businessName,
      email: businesses.email,
      stage: businesses.stage,
      priceArm: businesses.priceArm,
      lastAt: latest.at,
      lastDirection: latest.direction,
      lastBody: latest.body,
      unread: sql<number>`coalesce(${unread.count}, 0)::int`,
    })
    .from(latest)
    .innerJoin(businesses, eq(businesses.id, latest.businessId))
    .leftJoin(unread, eq(unread.businessId, latest.businessId))
    .orderBy(desc(latest.at));
  return rows.map(({ lastAt, lastDirection, lastBody, unread: count, ...business }) => ({
    business,
    lastAt,
    lastDirection,
    lastBody,
    unread: count,
  }));
}

export async function threadFor(businessId: string): Promise<Message[]> {
  return (await db()).select().from(messages).where(eq(messages.businessId, businessId)).orderBy(asc(messages.at));
}

export async function markThreadRead(businessId: string) {
  await (await db())
    .update(messages)
    .set({ readAt: new Date() })
    .where(and(eq(messages.businessId, businessId), eq(messages.direction, "in"), isNull(messages.readAt)));
}

function replySubject(thread: Message[], business: Business) {
  const subject = [...thread].reverse().find((m) => m.subject)?.subject ?? business.businessName;
  return subject.startsWith("Re:") ? subject : `Re: ${subject}`;
}

/** The address to answer: whoever last wrote in, or the lead's own address. */
function replyAddress(thread: Message[], business: Business) {
  return [...thread].reverse().find((m) => m.direction === "in")?.fromAddress ?? business.email;
}

export async function sendReply(businessId: string, body: string, founder: Founder): Promise<{ ok: boolean; error?: string }> {
  const business = await businessById(businessId);
  if (!business) return { ok: false, error: "That business no longer exists." };
  if (!body.trim()) return { ok: false, error: "Write something first." };
  if (business.stage === "opted_out") return { ok: false, error: "They opted out. Nothing more can be sent to them." };
  const thread = await threadFor(businessId);
  const last = thread.at(-1);
  try {
    const delivery = await deliver(
      (from) => ({
        from: { name: founder.name, email: from?.email ?? "outbox@dev.localhost" },
        to: replyAddress(thread, business),
        subject: replySubject(thread, business),
        body: body.trim(),
        threadId: last?.threadId ?? business.threadId,
        inReplyTo: last?.headerMessageId || null,
      }),
      business.mailboxId,
    );
    await (await db()).insert(messages).values({
      businessId,
      mailboxId: delivery.mailbox?.id ?? null,
      direction: "out",
      kind: "reply",
      gmailId: delivery.gmailId,
      threadId: delivery.threadId,
      headerMessageId: delivery.headerMessageId,
      fromAddress: delivery.email.from.email,
      toAddress: delivery.email.to,
      subject: delivery.email.subject,
      body: delivery.email.body,
      sentBy: founder.email,
    });
    await updateBusiness(businessId, { lastContactAt: new Date() });
    await record(founder.email, "replied", { businessId, detail: delivery.email.to });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Nothing was sent. ${(error as Error).message}` };
  }
}
