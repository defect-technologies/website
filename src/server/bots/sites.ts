import "server-only";
import { SignJWT } from "jose";
import { z } from "zod";
import { env } from "../env";
import type { BotKey, Business, PreviewJob } from "../db/schema";
import { launchDomainOf } from "../integrations/domain";
import { billingPortalLink } from "../integrations/stripe";
import { latestJob, launchBlocker, requestPreview } from "../runner/jobs";
import { actorOf, BotError } from "./http";
import { ownedLead } from "./leads";

/** Matches site-kit's editor session cookie, so the admin edits a live site exactly as an owner would. */
const SESSION_COOKIE = "defect_editor";
const SESSION_TYPE = "editor-session";
const SESSION_SECONDS = 5 * 60;
/** site-kit's review link: shows the owner their site's unpublished changes and lets them publish those. */
const REVIEW_TYPE = "review";
const REVIEW_DAYS = 14;
const VERCEL_A = "76.76.21.21";
const LOOKUP_TIMEOUT_MS = 4000;

function requireBot(key: BotKey, bots: string[], what: string) {
  if (!bots.includes(key.bot)) throw new BotError(403, `Only ${bots.join(" and ")} ${what}.`);
}

export const CorrectionsBody = z.object({ request: z.string().trim().min(1).max(4000) });

/** POST /leads/:id/corrections: rebuilds the preview with the client's words as the note. A launched site goes live again only through POST /leads/:id/publish. */
export async function requestCorrections(key: BotKey, id: string, body: z.infer<typeof CorrectionsBody>) {
  requireBot(key, ["onboarding", "client_care"], "send corrections to the builder");
  const lead = await ownedLead(key, id);
  const note = `The owner asked for these changes, in their own words. Make exactly these and nothing else:\n\n${body.request}`;
  const { job, created } = await requestPreview(lead, actorOf(key), note);
  return { ok: true, jobId: job.id, alreadyRunning: !created, status: job.status };
}

/** POST /leads/:id/launch: puts a paid client's site live on its own project, at the domain on file. */
export async function requestLaunch(key: BotKey, id: string) {
  requireBot(key, ["onboarding"], "launch sites");
  const lead = await ownedLead(key, id);
  const blocker = launchBlocker(lead);
  if (blocker) throw new BotError(409, blocker);
  if (!launchDomainOf(lead)) throw new BotError(409, "This lead has no website address on file to launch at. Flag it for a founder.");
  const { job, created } = await requestPreview(lead, actorOf(key), "", "launch");
  if (job.kind !== "launch") throw new BotError(409, "A build for this lead is still running. Launch once it's done.");
  return { ok: true, jobId: job.id, alreadyRunning: !created, status: job.status };
}

type RecordType = "A" | "CNAME" | "TXT";
type LaunchRecord = { host: string; type: RecordType; name: string; value: string };
type LaunchResult = { projectId: string; liveUrl: string; records: LaunchRecord[] };

async function resolves(host: string, type: RecordType, expected: (data: string) => boolean): Promise<boolean> {
  try {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      cache: "no-store",
    });
    const answer = ((await response.json()) as { Answer?: { data: string }[] }).Answer ?? [];
    return answer.some((entry) => expected(entry.data.replace(/\.$/, "")));
  } catch {
    return false;
  }
}

const apexOf = (host: string) => host.split(".").slice(-2).join(".");

const IS_IN_PLACE: Record<RecordType, (entry: LaunchRecord) => Promise<boolean>> = {
  A: (entry) => resolves(entry.host, "A", (data) => data === VERCEL_A),
  CNAME: (entry) => resolves(entry.host, "CNAME", (data) => data.endsWith("vercel-dns.com")),
  TXT: (entry) => resolves(`${entry.name}.${apexOf(entry.host)}`, "TXT", (data) => data.includes(entry.value)),
};

/** Whether the owner's domain already points at the launched site, with any ownership check Vercel asked for. */
async function connected(records: LaunchRecord[]): Promise<boolean> {
  if (records.length === 0) return false;
  return (await Promise.all(records.map((entry) => IS_IN_PLACE[entry.type](entry)))).every(Boolean);
}

function jobState(job: PreviewJob | null) {
  if (!job) return null;
  return { status: job.status, requestedBy: job.requestedBy, note: job.note, requestedAt: job.createdAt, finishedAt: job.finishedAt };
}

/** The lead's latest preview build and launch, as a bot needs them to know what to tell the client. */
export async function buildAndLaunchState(lead: Business) {
  const [build, launch] = await Promise.all([latestJob(lead.id, "preview"), latestJob(lead.id, "launch")]);
  const result = (launch?.status === "done" ? launch.result : null) as LaunchResult | null;
  return {
    previewBuild: jobState(build),
    launch: launch && {
      ...jobState(launch),
      liveUrl: result?.liveUrl ?? "",
      records: result?.records ?? [],
      domainConnected: result ? await connected(result.records) : false,
    },
  };
}

async function editorCookie(lead: Business, actor: string): Promise<string> {
  const secret = env.editorSecret();
  if (!secret) throw new BotError(503, "EDITOR_SECRET isn't set on the admin, so live sites can't be edited yet.");
  const token = await new SignJWT({ site: lead.slug, typ: SESSION_TYPE })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(actor)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(new TextEncoder().encode(secret));
  return `${SESSION_COOKIE}=${token}`;
}

/** The kit's actor pattern allows letters, digits and dashes after bot:. */
const editorActor = (key: BotKey) => `bot:${key.bot.replace(/_/g, "-")}`;

/** The launched site's own vercel.app address, which answers even before the owner's domain points at it. */
async function launchedUrl(lead: Business): Promise<string> {
  const launch = await latestJob(lead.id, "launch");
  const result = (launch?.status === "done" ? launch.result : null) as LaunchResult | null;
  if (!result) throw new BotError(409, "This site hasn't launched, so there's no live content to read or change.");
  return result.liveUrl;
}

async function callEditor(key: BotKey, lead: Business, request: unknown) {
  const response = await fetch(new URL("/edit/api", await launchedUrl(lead)), {
    method: "POST",
    headers: { "content-type": "application/json", cookie: await editorCookie(lead, editorActor(key)) },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(20_000),
  });
  const reply = (await response.json().catch(() => null)) as { ok: boolean; message: string; issues?: unknown; draft?: unknown; pending?: string[] } | null;
  if (!reply) throw new BotError(502, `The live site answered ${response.status} without a result. Try again on the next run.`);
  return reply;
}

/** GET /leads/:id/content: every page, business detail and theme setting on the live site. */
export async function readContent(key: BotKey, id: string) {
  requireBot(key, ["client_care"], "read live sites");
  const lead = await ownedLead(key, id);
  const reply = await callEditor(key, lead, { action: "read" });
  if (!reply.ok) throw new BotError(502, reply.message);
  return {
    content: reply.draft,
    pending: reply.pending ?? [],
    keys: "Change one with POST /leads/<id>/content: key is theme, module:<name> (like module:hours) or page:<path> (like page:/ or page:/about), and document is the whole new value for that key. Changes wait for the owner's review; pending lists the ones waiting.",
  };
}

export const ContentBody = z.object({ key: z.string().trim().min(1).max(200), document: z.unknown() });

/** Every change is saved as a draft: it goes live only once the owner approves it. */
function editorRequest(key: string, document: unknown) {
  if (key === "theme") return { action: "saveTheme", theme: document, publish: false };
  if (key.startsWith("module:")) return { action: "saveModule", module: key.slice("module:".length), data: document, publish: false };
  if (key.startsWith("page:")) return { action: "savePage", path: key.slice("page:".length), page: document, publish: false };
  throw new BotError(400, `"${key}" isn't a content key. Use theme, module:<name> or page:<path>.`);
}

/** POST /leads/:id/content: saves one changed document for the owner's review, through the site's own editor checks. */
export async function changeContent(key: BotKey, id: string, body: z.infer<typeof ContentBody>) {
  requireBot(key, ["client_care"], "change live sites");
  const lead = await ownedLead(key, id);
  const reply = await callEditor(key, lead, editorRequest(body.key, body.document));
  if (!reply.ok) throw new BotError(422, `${reply.message} ${JSON.stringify(reply.issues ?? [])}`);
  return { ok: true, message: `${reply.message} It isn't live yet: send the owner a review link (POST /leads/<id>/review-link).` };
}

/** POST /leads/:id/review-link: a link, good for 14 days, where the owner sees the waiting changes on their site and can publish them. */
export async function reviewLink(key: BotKey, id: string) {
  requireBot(key, ["client_care"], "send review links");
  const lead = await ownedLead(key, id);
  const secret = env.editorSecret();
  if (!secret) throw new BotError(503, "EDITOR_SECRET isn't set on the admin, so review links can't be made yet.");
  const owner = lead.ownerEmail || lead.email;
  if (!owner) throw new BotError(409, "This client has no owner email on file, so a review link can't name who approves. Flag it for a founder.");
  const token = await new SignJWT({ site: lead.slug, typ: REVIEW_TYPE })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(owner)
    .setIssuedAt()
    .setExpirationTime(`${REVIEW_DAYS}d`)
    .sign(new TextEncoder().encode(secret));
  const url = new URL("/edit/review", lead.siteUrl || (await launchedUrl(lead)));
  url.searchParams.set("token", token);
  return { url: url.toString(), expiresInDays: REVIEW_DAYS };
}

/** A design change built since the site last launched, waiting for the owner's OK. */
async function designWaiting(lead: Business): Promise<boolean> {
  const [build, launch] = await Promise.all([latestJob(lead.id, "preview"), latestJob(lead.id, "launch")]);
  if (build?.status !== "done" || !build.finishedAt) return false;
  return !launch?.finishedAt || build.finishedAt > launch.finishedAt;
}

/** POST /leads/:id/publish: once the owner approves by email, puts their waiting content changes live and launches any rebuilt design. */
export async function publishChanges(key: BotKey, id: string) {
  requireBot(key, ["client_care"], "publish changes");
  const lead = await ownedLead(key, id);
  const reply = await callEditor(key, lead, { action: "publishDrafts" });
  if (!reply.ok) throw new BotError(502, reply.message);
  if (!(await designWaiting(lead))) return { ok: true, message: reply.message, relaunching: false };
  await requestPreview(lead, actorOf(key), "Publish the design changes the owner approved.", "launch");
  return { ok: true, message: `${reply.message} The rebuilt design is going live: check launch.status.`, relaunching: true };
}

/** POST /leads/:id/billing-link: a one-time Stripe page where the client updates their card, sees invoices, switches plans or cancels. */
export async function billingLink(key: BotKey, id: string) {
  requireBot(key, ["client_care", "onboarding"], "send billing links");
  const lead = await ownedLead(key, id);
  if (!lead.stripeCustomerId) throw new BotError(409, "This lead has no Stripe customer, so there's no billing page. Flag it for a founder.");
  return { url: await billingPortalLink(lead.stripeCustomerId, lead.siteUrl || "https://defect.tech") };
}
