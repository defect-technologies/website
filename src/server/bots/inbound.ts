import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ABOUT_LIMIT, INBOUND_KINDS, INBOUND_STATUSES, SORTED_KINDS, type InboundKind } from "@/lib/inbound";
import { unwrapLinks, withoutSubjectLine } from "@/lib/emailLinks";
import { record } from "../activity";
import { db } from "../db/client";
import { inboundRequests, type BotKey, type InboundRequest } from "../db/schema";
import { claimOpenRequest, inboundById, InboundError, openOfKinds, pastOfKinds, replyToRequest, withClaim, requestLink, tellFoundersAbout } from "../inbound/requests";
import { BOT_READ_FRESH_MS, syncMailIfStale } from "../mail/sync";
import { FlagBody, raiseFlag } from "./flags";
import { actorOf, BotError } from "./http";
import { checkBody, ReplyBody } from "./reply";
import { normalizeEmail, sitesEditedBy, type EditedSiteOf } from "../sites/siteEditors";

/** Client care sorts and answers mail from unknown senders; the Overseer may read it. */
function mustBe(key: BotKey, bots: string[]) {
  if (!bots.includes(key.bot)) throw new BotError(403, "Emails from unknown senders belong to the Client care bot.");
}

/**
 * The client sites the sender edits. An editor isn't the owner, so they aren't verified for change requests:
 * the bot points them to their portal or to the owner (02-system/change-requests.md).
 */
function editorOf(request: InboundRequest, edited: EditedSiteOf[]) {
  const sender = normalizeEmail(request.email);
  return edited.filter((site) => site.email === sender).map(({ slug, url, businessId, ownerEmail }) => ({ leadId: businessId, slug, siteUrl: url, ownerEmail }));
}

function inboundView(request: InboundRequest, edited: EditedSiteOf[] = []) {
  return {
    editorOf: editorOf(request, edited),
    id: request.id,
    at: request.at,
    source: request.source,
    kind: request.kind,
    status: request.status,
    from: request.email,
    name: request.name,
    subject: request.subject,
    body: request.body,
    businessName: request.businessName,
    website: request.website,
    about: request.about,
    reason: request.reason,
    sortedBy: request.sortedBy,
    replyBody: request.replyBody,
    repliedAt: request.repliedAt,
    adminLink: requestLink(request.id),
  };
}


export const InboundQuery = z.object({
  status: z.enum(INBOUND_STATUSES).default("open"),
  kind: z.enum(INBOUND_KINDS).optional(),
});

/** GET /inbound: emails to hello@defect.tech from addresses that match no lead, plus requests from the form. */
export async function listInbound(key: BotKey, query: z.infer<typeof InboundQuery>) {
  mustBe(key, ["client_care", "overseer"]);
  await syncMailIfStale(BOT_READ_FRESH_MS);
  const kinds: InboundKind[] = query.kind ? [query.kind] : [...INBOUND_KINDS];
  const rows = query.status === "open" ? await openOfKinds(kinds) : await pastOfKinds(query.status, kinds);
  const edited = await sitesEditedBy(rows.map((row) => row.email));
  return { inbound: rows.map((row) => inboundView(row, edited)) };
}

export async function inboundForBot(key: BotKey, id: string) {
  mustBe(key, ["client_care", "overseer"]);
  const request = await inboundById(id);
  if (!request) throw new BotError(404, "Nothing in the inbound list has that ID.");
  return inboundView(request, await sitesEditedBy([request.email]));
}

const Text = (max: number) => z.string().trim().max(max).default("");

export const SortBody = z
  .object({
    kind: z.enum(SORTED_KINDS),
    reason: z.string().trim().min(1).max(300),
    name: Text(200),
    businessName: Text(200),
    website: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]).default(""),
    about: Text(ABOUT_LIMIT),
    flag: FlagBody.optional(),
  })
  .superRefine((body, context) => {
    if (body.kind === "founder" && !body.flag) context.addIssue({ code: "custom", path: ["flag"], message: "An email that needs a founder needs a flag: headline, needs, ask and options." });
    if (body.kind === "request" && !body.businessName) context.addIssue({ code: "custom", path: ["businessName"], message: "Give the business's name for a website request." });
  });

const STATUS_AFTER_SORT: Record<(typeof SORTED_KINDS)[number], InboundRequest["status"]> = { request: "open", founder: "open", bot: "open", ignore: "closed" };

async function flagFor(request: InboundRequest, body: z.infer<typeof SortBody>): Promise<string | null> {
  if (body.kind !== "founder" || !body.flag) return null;
  const { flag } = await raiseFlag("client_care", null, { ...body.flag, link: requestLink(request.id) });
  return flag.id;
}

/** Takes the email in one statement, so two sorts of the same email cannot both go on to raise a flag. */
async function claimForSort(request: InboundRequest, key: BotKey, body: z.infer<typeof SortBody>): Promise<InboundRequest> {
  const details = { name: body.name, businessName: body.businessName, website: body.website, about: body.about };
  const [sorted] = await (await db())
    .update(inboundRequests)
    .set({ ...details, kind: body.kind, status: STATUS_AFTER_SORT[body.kind], reason: body.reason, sortedBy: actorOf(key), sortedAt: new Date() })
    .where(and(eq(inboundRequests.id, request.id), eq(inboundRequests.kind, "unsorted")))
    .returning();
  if (!sorted) throw new BotError(409, "This email was sorted a moment ago. A founder can move it from Today in the admin.");
  return sorted;
}

/** POST /inbound/:id/sort: the bot says what an email is. Requests go to the founders; a founder email becomes a flag. */
export async function sortInbound(key: BotKey, id: string, body: z.infer<typeof SortBody>) {
  mustBe(key, ["client_care"]);
  const request = await inboundById(id);
  if (!request) throw new BotError(404, "Nothing in the inbound list has that ID.");
  if (request.kind !== "unsorted") throw new BotError(409, `This email was already sorted as ${request.kind}. A founder can move it from Today in the admin.`);
  const sorted = await claimForSort(request, key, body);
  const flagId = await withClaim(request, () => flagFor(request, body));
  if (flagId) await (await db()).update(inboundRequests).set({ flagId }).where(eq(inboundRequests.id, id));
  await record(actorOf(key), `sorted an email to hello@ as ${body.kind}`, { detail: `${request.email}: ${body.reason}` });
  if (body.kind === "request") await tellFoundersAbout(sorted);
  return { ok: true, kind: sorted.kind, status: sorted.status, flagId };
}

async function claimForReply(id: string, by: string) {
  try {
    await claimOpenRequest(id, { status: "answered", decidedBy: by }, { kind: "bot" });
  } catch (error) {
    if (error instanceof InboundError) throw new BotError(409, "Someone already answered this email.");
    throw error;
  }
}

/** POST /inbound/:id/reply: answers an email the bot sorted as one it can answer, from hello@defect.tech in its thread. */
export async function replyToInbound(key: BotKey, id: string, input: z.infer<typeof ReplyBody>) {
  mustBe(key, ["client_care"]);
  const request = await inboundById(id);
  if (!request) throw new BotError(404, "Nothing in the inbound list has that ID.");
  if (request.kind !== "bot" || request.status !== "open") throw new BotError(409, "Only open emails you sorted as bot can be answered here. Requests and founder emails wait for a founder.");
  const { text: body } = unwrapLinks(withoutSubjectLine(input.body));
  checkBody(body);
  await claimForReply(id, actorOf(key));
  await withClaim(request, () => replyToRequest(request, body, actorOf(key)));
  return { ok: true, to: request.email };
}
