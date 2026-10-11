import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ABOUT_LIMIT, INBOUND_KINDS, INBOUND_STATUSES, SORTED_KINDS, type InboundKind } from "@/lib/inbound";
import { unwrapLinks, withoutSubjectLine } from "@/lib/emailLinks";
import { record } from "../activity";
import { db } from "../db/client";
import { inboundRequests, mailboxes, type BotKey, type InboundRequest } from "../db/schema";
import { inboundById, openOfKinds, pastRequests, replyToRequest, requestLink, tellFoundersAbout } from "../inbound/requests";
import { syncMail } from "../mail/sync";
import { STUDIO_INBOX } from "../onboarding/welcome";
import { FlagBody, raiseFlag } from "./flags";
import { actorOf, BotError } from "./http";
import { checkBody, ReplyBody } from "./reply";

/** Client care sorts and answers mail from unknown senders; the Overseer may read it. */
function mustBe(key: BotKey, bots: string[]) {
  if (!bots.includes(key.bot)) throw new BotError(403, "Emails from unknown senders belong to the Client care bot.");
}

function inboundView(request: InboundRequest) {
  return {
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

const FRESH_FOR = 5 * 60 * 1000;

/** The bot runs more often than the half-hourly sync, so a read past five minutes old reads hello@ again first. */
async function syncIfStale() {
  const [studio] = await (await db()).select().from(mailboxes).where(eq(mailboxes.email, STUDIO_INBOX));
  if (!studio || (studio.lastSyncedAt && Date.now() - studio.lastSyncedAt.getTime() < FRESH_FOR)) return;
  await syncMail().catch((error) => console.error("[inbound] sync", error));
}

export const InboundQuery = z.object({
  status: z.enum(INBOUND_STATUSES).default("open"),
  kind: z.enum(INBOUND_KINDS).optional(),
});

/** GET /inbound: emails to hello@defect.tech from addresses that match no lead, plus requests from the form. */
export async function listInbound(key: BotKey, query: z.infer<typeof InboundQuery>) {
  mustBe(key, ["client_care", "overseer"]);
  await syncIfStale();
  const kinds: InboundKind[] = query.kind ? [query.kind] : [...INBOUND_KINDS];
  const rows = query.status === "open" ? await openOfKinds(kinds) : (await pastRequests()).filter((row) => row.status === query.status && kinds.includes(row.kind));
  return { inbound: rows.map(inboundView) };
}

export async function inboundForBot(key: BotKey, id: string) {
  mustBe(key, ["client_care", "overseer"]);
  const request = await inboundById(id);
  if (!request) throw new BotError(404, "Nothing in the inbound list has that ID.");
  return inboundView(request);
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

/** POST /inbound/:id/sort: the bot says what an email is. Requests go to the founders; a founder email becomes a flag. */
export async function sortInbound(key: BotKey, id: string, body: z.infer<typeof SortBody>) {
  mustBe(key, ["client_care"]);
  const request = await inboundById(id);
  if (!request) throw new BotError(404, "Nothing in the inbound list has that ID.");
  if (request.kind !== "unsorted") throw new BotError(409, `This email was already sorted as ${request.kind}. A founder can move it on the Requests page.`);
  const flagId = await flagFor(request, body);
  const details = { name: body.name, businessName: body.businessName, website: body.website, about: body.about };
  const [sorted] = await (await db())
    .update(inboundRequests)
    .set({ ...details, kind: body.kind, status: STATUS_AFTER_SORT[body.kind], reason: body.reason, sortedBy: actorOf(key), sortedAt: new Date(), flagId })
    .where(eq(inboundRequests.id, id))
    .returning();
  await record(actorOf(key), `sorted an email to hello@ as ${body.kind}`, { detail: `${request.email}: ${body.reason}` });
  if (body.kind === "request") await tellFoundersAbout(sorted);
  return { ok: true, kind: sorted.kind, status: sorted.status, flagId };
}

/** POST /inbound/:id/reply: answers an email the bot sorted as one it can answer, from hello@defect.tech in its thread. */
export async function replyToInbound(key: BotKey, id: string, input: z.infer<typeof ReplyBody>) {
  mustBe(key, ["client_care"]);
  const request = await inboundById(id);
  if (!request) throw new BotError(404, "Nothing in the inbound list has that ID.");
  if (request.kind !== "bot" || request.status !== "open") throw new BotError(409, "Only open emails you sorted as bot can be answered here. Requests and founder emails wait for a founder.");
  const { text: body } = unwrapLinks(withoutSubjectLine(input.body));
  checkBody(body);
  await replyToRequest(request, body, actorOf(key));
  await (await db()).update(inboundRequests).set({ status: "answered", decidedAt: new Date(), decidedBy: actorOf(key) }).where(eq(inboundRequests.id, id));
  return { ok: true, to: request.email };
}
