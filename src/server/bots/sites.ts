import "server-only";
import { SignJWT } from "jose";
import { z } from "zod";
import { env } from "../env";
import type { BotKey, Business, PreviewJob } from "../db/schema";
import { domainOf } from "../integrations/domain";
import { billingPortalLink } from "../integrations/stripe";
import { latestJob, requestPreview } from "../runner/jobs";
import { actorOf, BotError } from "./http";
import { ownedLead } from "./leads";

/** Matches site-kit's editor session cookie, so the admin edits a live site exactly as an owner would. */
const SESSION_COOKIE = "defect_editor";
const SESSION_TYPE = "editor-session";
const SESSION_SECONDS = 5 * 60;
const VERCEL_A = "76.76.21.21";
const LOOKUP_TIMEOUT_MS = 4000;

function requireBot(key: BotKey, bots: string[], what: string) {
  if (!bots.includes(key.bot)) throw new BotError(403, `Only ${bots.join(" and ")} ${what}.`);
}

export const CorrectionsBody = z.object({ request: z.string().trim().min(1).max(4000) });

/** POST /leads/:id/corrections: rebuilds the preview with the client's words as the note. A launched site redeploys after. */
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
  if (!lead.paidAt) throw new BotError(409, "This lead hasn't paid, so its site can't launch.");
  if (!lead.previewUrl) throw new BotError(409, "This lead has no built preview to launch yet.");
  if (!domainOf(lead.website)) throw new BotError(409, "This lead has no website address on file to launch at. Flag it for a founder.");
  const { job, created } = await requestPreview(lead, actorOf(key), "", "launch");
  if (job.kind !== "launch") throw new BotError(409, "A build for this lead is still running. Launch once it's done.");
  return { ok: true, jobId: job.id, alreadyRunning: !created, status: job.status };
}

type LaunchRecord = { host: string; type: "A" | "CNAME"; name: string; value: string };
type LaunchResult = { projectId: string; liveUrl: string; records: LaunchRecord[] };

async function resolves(host: string, type: "A" | "CNAME", expected: (data: string) => boolean): Promise<boolean> {
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

/** Whether the owner's domain already points at the launched site. */
async function connected(records: LaunchRecord[]): Promise<boolean> {
  if (records.length === 0) return false;
  const checks = records.map((entry) => (entry.type === "A" ? resolves(entry.host, "A", (data) => data === VERCEL_A) : resolves(entry.host, "CNAME", (data) => data.endsWith("vercel-dns.com"))));
  return (await Promise.all(checks)).every(Boolean);
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

async function callEditor(key: BotKey, lead: Business, request: unknown) {
  const launch = await latestJob(lead.id, "launch");
  const result = (launch?.status === "done" ? launch.result : null) as LaunchResult | null;
  if (!result) throw new BotError(409, "This site hasn't launched, so there's no live content to read or change.");
  const response = await fetch(new URL("/edit/api", result.liveUrl), {
    method: "POST",
    headers: { "content-type": "application/json", cookie: await editorCookie(lead, editorActor(key)) },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(20_000),
  });
  const reply = (await response.json().catch(() => null)) as { ok: boolean; message: string; issues?: unknown; draft?: unknown } | null;
  if (!reply) throw new BotError(502, `The live site answered ${response.status} without a result. Try again on the next run.`);
  return reply;
}

/** GET /leads/:id/content: every page, business detail and theme setting on the live site. */
export async function readContent(key: BotKey, id: string) {
  requireBot(key, ["client_care"], "read live sites");
  const lead = await ownedLead(key, id);
  const reply = await callEditor(key, lead, { action: "read" });
  if (!reply.ok) throw new BotError(502, reply.message);
  return { content: reply.draft, keys: "Change one with POST /leads/<id>/content: key is theme, module:<name> (like module:hours) or page:<path> (like page:/ or page:/about), and document is the whole new value for that key." };
}

export const ContentBody = z.object({ key: z.string().trim().min(1).max(200), document: z.unknown() });

function editorRequest(key: string, document: unknown) {
  if (key === "theme") return { action: "saveTheme", theme: document };
  if (key.startsWith("module:")) return { action: "saveModule", module: key.slice("module:".length), data: document };
  if (key.startsWith("page:")) return { action: "savePage", path: key.slice("page:".length), page: document, publish: true };
  throw new BotError(400, `"${key}" isn't a content key. Use theme, module:<name> or page:<path>.`);
}

/** POST /leads/:id/content: publishes one changed document through the site's own editor checks. */
export async function changeContent(key: BotKey, id: string, body: z.infer<typeof ContentBody>) {
  requireBot(key, ["client_care"], "change live sites");
  const lead = await ownedLead(key, id);
  const reply = await callEditor(key, lead, editorRequest(body.key, body.document));
  if (!reply.ok) throw new BotError(422, `${reply.message} ${JSON.stringify(reply.issues ?? [])}`);
  return { ok: true, message: reply.message };
}

/** POST /leads/:id/billing-link: a one-time Stripe page where the client updates their card, sees invoices, switches plans or cancels. */
export async function billingLink(key: BotKey, id: string) {
  requireBot(key, ["client_care", "onboarding"], "send billing links");
  const lead = await ownedLead(key, id);
  if (!lead.stripeCustomerId) throw new BotError(409, "This lead has no Stripe customer, so there's no billing page. Flag it for a founder.");
  return { url: await billingPortalLink(lead.stripeCustomerId, lead.siteUrl || "https://defect.tech") };
}
