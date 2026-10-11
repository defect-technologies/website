import "server-only";
import { createHmac } from "node:crypto";
import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { INBOUND_PRICE_ARM, type InboundKind } from "@/lib/inbound";
import { replySubject } from "@/lib/emailLinks";
import { record } from "../activity";
import { db } from "../db/client";
import { businesses, inboundRequests, type Business, type InboundRequest, type Mailbox } from "../db/schema";
import { env } from "../env";
import { emailFounders } from "../flags/notify";
import { resolveFlag } from "../bots/flags";
import { htmlFor } from "../bots/reply";
import { businessById, updateBusiness } from "../leads/businesses";
import { newLinkCode, uniqueSlug } from "../leads/import";
import type { IncomingEmail } from "../mail/gmail";
import { domainOf } from "../mail/mime";
import { deliver } from "../mail/outbox";
import { STUDIO_INBOX, STUDIO_NAME, studioMailboxId } from "../onboarding/welcome";
import { requestPreview } from "../runner/jobs";

/** A refusal a founder or the form can show as is. */
export class InboundError extends Error {}

const HOUR = 60 * 60 * 1000;
/** One address may send the form this many times an hour, and the form takes this many requests a day in all. */
const FORM_LIMITS = { perAddressPerHour: 3, perDay: 50 };

export const requestLink = (id: string) => `${env.siteUrl()}/admin/requests#request-${id}`;

/** A keyed hash, so the stored value can't be turned back into the address. */
export function hashAddress(ip: string): string {
  return createHmac("sha256", env.authSecret()).update(`inbound-form:${ip}`).digest("base64url");
}

async function countSince(since: Date, ipHash?: string): Promise<number> {
  const [row] = await (await db())
    .select({ count: sql<number>`count(*)::int` })
    .from(inboundRequests)
    .where(and(eq(inboundRequests.source, "form"), gte(inboundRequests.at, since), ipHash ? eq(inboundRequests.ipHash, ipHash) : undefined));
  return row?.count ?? 0;
}

export async function formIsBusy(ipHash: string): Promise<boolean> {
  const now = Date.now();
  const [fromAddress, today] = await Promise.all([countSince(new Date(now - HOUR), ipHash), countSince(new Date(now - 24 * HOUR))]);
  return fromAddress >= FORM_LIMITS.perAddressPerHour || today >= FORM_LIMITS.perDay;
}

export async function tellFoundersAbout(request: InboundRequest) {
  const where = request.website || "No website yet";
  const body = [`${request.businessName || request.email} asked us for a website.`, where, request.about, `Approve or turn it down: ${requestLink(request.id)}`];
  await emailFounders(`Website request: ${request.businessName || request.email}`, body.filter(Boolean).join("\n\n")).catch((error) => console.error("[inbound] tell founders", error));
}

export type FormRequest = Pick<InboundRequest, "name" | "email" | "businessName" | "website" | "about">;

export async function createFormRequest(input: FormRequest, ipHash: string): Promise<InboundRequest> {
  const [created] = await (await db())
    .insert(inboundRequests)
    .values({ ...input, source: "form", kind: "request", ipHash })
    .returning();
  await record("website form", "website request received", { detail: `${input.businessName} (${input.email})` });
  await tellFoundersAbout(created);
  return created;
}

const AUTOMATED_SENDER = /^(?:no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounces?)[@+.-]/i;

/** Our own mail, the founders' and bounce notices never need sorting. */
function needsSorting(email: IncomingEmail): boolean {
  const from = email.from.toLowerCase();
  if (AUTOMATED_SENDER.test(from)) return false;
  if (env.founderEmails().includes(from)) return false;
  return domainOf(from) !== domainOf(STUDIO_INBOX);
}

/** Mail sync calls this for mail to hello@defect.tech from someone who matches no lead. */
export async function recordUnmatchedEmail(mailbox: Mailbox, email: IncomingEmail): Promise<boolean> {
  if (mailbox.email.toLowerCase() !== STUDIO_INBOX || !needsSorting(email)) return false;
  const inserted = await (await db())
    .insert(inboundRequests)
    .values({
      source: "email",
      email: email.from,
      subject: email.subject,
      body: email.body,
      gmailId: email.gmailId,
      threadId: email.threadId,
      headerMessageId: email.headerMessageId,
      mailboxId: mailbox.id,
      at: email.at,
    })
    .onConflictDoNothing()
    .returning({ id: inboundRequests.id });
  return inserted.length > 0;
}

export async function inboundById(id: string): Promise<InboundRequest | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await (await db()).select().from(inboundRequests).where(eq(inboundRequests.id, id));
  return row ?? null;
}

export async function openOfKinds(kinds: InboundKind[]): Promise<InboundRequest[]> {
  return (await db())
    .select()
    .from(inboundRequests)
    .where(and(eq(inboundRequests.status, "open"), inArray(inboundRequests.kind, kinds)))
    .orderBy(desc(inboundRequests.at))
    .limit(200);
}

export async function pastRequests(limit = 200): Promise<InboundRequest[]> {
  return (await db()).select().from(inboundRequests).where(ne(inboundRequests.status, "open")).orderBy(desc(inboundRequests.at)).limit(limit);
}

/** Requests and emails a founder has to answer, for the admin's nav. */
export async function waitingRequestCount(): Promise<number> {
  const [row] = await (await db())
    .select({ count: sql<number>`count(*)::int` })
    .from(inboundRequests)
    .where(and(eq(inboundRequests.status, "open"), eq(inboundRequests.kind, "request")));
  return row?.count ?? 0;
}

const SHARED_MAIL_DOMAINS = new Set(["gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "me.com", "aol.com", "proton.me"]);

export type LeadMatcher = (fields: Pick<InboundRequest, "email" | "website">) => Business | null;

/** Finds the lead we already have for a business: the same email address, or the same website or company email domain. */
export async function leadMatcher(): Promise<LeadMatcher> {
  const rows = await (await db()).select().from(businesses);
  return (fields) => {
    const email = fields.email.toLowerCase();
    const domains = [domainOf(fields.website), domainOf(email)].filter((domain) => domain && !SHARED_MAIL_DOMAINS.has(domain));
    return (
      rows.find((lead) => [lead.email, lead.ownerEmail].some((address) => address.toLowerCase() === email)) ??
      rows.find((lead) => domains.some((domain) => [domainOf(lead.website), domainOf(lead.email)].includes(domain))) ??
      null
    );
  };
}

export type AcceptFields = Pick<InboundRequest, "name" | "email" | "businessName" | "website" | "about">;

const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? "";

async function createLead(fields: AcceptFields, request: InboundRequest): Promise<Business> {
  const database = await db();
  const slugs = new Set((await database.select({ slug: businesses.slug }).from(businesses)).map((row) => row.slug));
  const [lead] = await database
    .insert(businesses)
    .values({
      slug: uniqueSlug(fields.businessName, slugs),
      linkCode: newLinkCode(),
      businessName: fields.businessName,
      website: fields.website,
      email: fields.email,
      ownerFirstName: firstNameOf(fields.name),
      brief: fields.website ? "" : fields.about,
      source: "request",
      priceArm: INBOUND_PRICE_ARM,
      foundDate: new Date().toISOString().slice(0, 10),
      note: [`Asked us for a website ${request.source === "form" ? "through the form on defect.tech" : "by email"}.`, fields.website ? fields.about : ""].filter(Boolean).join("\n"),
    })
    .returning();
  return lead;
}

/** A lead we found ourselves becomes a request when they ask before we've emailed them, so they get the request email, not the cold one. */
async function adoptLead(lead: Business, fields: AcceptFields): Promise<Business> {
  if (lead.firstSentAt) return lead;
  const brief = lead.website || fields.website ? lead.brief : fields.about;
  await updateBusiness(lead.id, { source: "request", brief, ownerFirstName: lead.ownerFirstName || firstNameOf(fields.name), priceArm: lead.priceArm ?? INBOUND_PRICE_ARM });
  return (await businessById(lead.id)) ?? lead;
}

async function openRequest(id: string): Promise<InboundRequest> {
  const request = await inboundById(id);
  if (!request) throw new InboundError("That request no longer exists.");
  if (request.status !== "open") throw new InboundError("Someone already dealt with this one.");
  return request;
}

async function finish(request: InboundRequest, fields: Partial<InboundRequest>) {
  await (await db())
    .update(inboundRequests)
    .set({ ...fields, decidedAt: new Date() })
    .where(eq(inboundRequests.id, request.id));
  if (request.flagId) await resolveFlag(request.flagId, "closed", "Dealt with on the Requests page.", fields.decidedBy ?? "");
}

/** Makes the business a lead (or finds the one we have) and queues its preview. */
export async function acceptRequest(id: string, fields: AcceptFields, by: string): Promise<Business> {
  const request = await openRequest(id);
  if (!fields.website && !fields.about.trim()) throw new InboundError("Add their website, or what they told us about the business, so the builder has something to work from.");
  const found = (await leadMatcher())(fields);
  const lead = found ? await adoptLead(found, fields) : await createLead(fields, request);
  if (!lead.previewUrl) await requestPreview(lead, by);
  await finish(request, { ...fields, kind: "request", status: "accepted", businessId: lead.id, decidedBy: by });
  await record(by, "accepted a website request", { businessId: lead.id, detail: found ? "matched a lead we already had" : "" });
  return lead;
}

const FORM_SUBJECT = "Your website request";

async function sendFromStudio(request: InboundRequest, body: string) {
  const subject = request.subject ? replySubject(request.subject) : FORM_SUBJECT;
  return deliver(
    (from) => ({
      from: { name: STUDIO_NAME, email: from?.email ?? "outbox@dev.localhost" },
      to: request.email,
      subject,
      body,
      html: htmlFor(body),
      threadId: request.threadId,
      inReplyTo: request.headerMessageId || null,
    }),
    await studioMailboxId(),
  );
}

/** Answers the person from hello@defect.tech, in their own thread when they emailed. */
export async function replyToRequest(request: InboundRequest, body: string, by: string) {
  await sendFromStudio(request, body);
  await (await db()).update(inboundRequests).set({ replyBody: body, repliedBy: by, repliedAt: new Date() }).where(eq(inboundRequests.id, request.id));
  await record(by, "answered an email to hello@", { detail: `${request.subject || FORM_SUBJECT} → ${request.email}` });
}

export async function declineRequest(id: string, reply: string, by: string) {
  const request = await openRequest(id);
  if (reply) await replyToRequest(request, reply, by);
  await finish(request, { status: "declined", decidedBy: by });
  await record(by, "turned down a website request", { detail: request.businessName || request.email });
}

/** A founder answered an email that needed them, or decided it needs no answer. */
export async function closeRequest(id: string, reply: string, by: string) {
  const request = await openRequest(id);
  if (reply) await replyToRequest(request, reply, by);
  await finish(request, { status: reply ? "answered" : "closed", decidedBy: by });
}

/** A founder sorts an email by hand, or moves one the bot sorted wrongly. Only requests reopen. */
export async function resortRequest(id: string, kind: Extract<InboundKind, "request" | "ignore">, by: string) {
  const request = await inboundById(id);
  if (!request || request.status === "accepted") throw new InboundError("That one can't be moved any more.");
  const status = kind === "request" ? "open" : "closed";
  await (await db()).update(inboundRequests).set({ kind, status, sortedBy: by, sortedAt: new Date() }).where(eq(inboundRequests.id, id));
  await record(by, kind === "request" ? "marked an email as a website request" : "ignored an email to hello@", { detail: request.subject || request.email });
}

