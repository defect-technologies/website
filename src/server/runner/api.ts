import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Bot } from "@/lib/bots";
import { record } from "../activity";
import { db } from "../db/client";
import { MAX_FAILED_BUILDS, type JobKind } from "@/lib/previewJobs";
import { flags, type BotKey, type Business, type PreviewJob } from "../db/schema";
import { env } from "../env";
import { launchDomainOf } from "../integrations/domain";
import { addClientSite } from "../sites/clientSites";
import { BotError } from "../bots/http";
import { ownedLead } from "../bots/leads";
import { checkoutLink } from "../leads/buildCommand";
import { updateBusiness } from "../leads/businesses";
import { outreachSettings } from "../settings";
import { autoQueueNext, buildsToday, claimNextJob, failuresInARow, isActive, jobById, leadForJob, requestPreview, updateJob } from "./jobs";
import { activePause, runnerSettings, updateRunnerSettings } from "./settings";

const ACTOR = "bot:runner";
const PAUSE_WITHOUT_RESUME_MS = 60 * 60 * 1000;
const LOG_TAIL_LIMIT = 8000;

/** No work for the runner, with the reason in a header it can log. */
function idle(reason: string) {
  return new NextResponse(null, { status: 204, headers: { "X-Runner-Reason": reason } });
}

/** Why the runner may not build previews right now, or null if it may. */
async function whyNoBuilds(): Promise<string | null> {
  const current = await runnerSettings();
  const pause = activePause(current);
  if (pause) return `Paused until ${pause.toISOString()} after Claude's usage limit.`;
  const today = await buildsToday();
  if (today >= current.dailyCap) return `Daily cap reached: ${today} of ${current.dailyCap} builds today (Pacific).`;
  return null;
}

/**
 * The kinds of work this runner may take now. A launch uses no Claude and a paying client is
 * waiting, so it goes ahead through a pause or the daily cap. Runners from before launches
 * existed don't send can=launch, so they're never handed one.
 */
function kindsAllowed(search: URLSearchParams, noBuilds: string | null): JobKind[] {
  const launches: JobKind[] = search.getAll("can").includes("launch") ? ["launch"] : [];
  return noBuilds ? launches : [...launches, "preview"];
}

/**
 * A launch carries the editor secret the live site signs owner sessions with, so the runner
 * needn't store it. It stays in the runner's memory for that one launch.
 */
function launchPayload(job: PreviewJob, lead: Business) {
  if (job.kind !== "launch") return {};
  const editorSecret = env.editorSecret();
  if (!editorSecret) throw new BotError(503, "EDITOR_SECRET isn't set on the admin, so a site can't be launched yet.");
  return { launch: { domain: launchDomainOf(lead) ?? "", editorSecret } };
}

function jobPayload(job: PreviewJob, lead: Business, checkoutUrl: string) {
  return {
    job: { id: job.id, attempt: job.attempts, note: job.note, kind: job.kind },
    lead: { id: lead.id, slug: lead.slug, businessName: lead.businessName, website: lead.website, priceArm: lead.priceArm ?? 59, checkoutUrl },
    ...launchPayload(job, lead),
  };
}

async function claimAutoQueued(runnerName: string, kinds: JobKind[]): Promise<PreviewJob | null> {
  if (!(await runnerSettings()).autoQueue) return null;
  return (await autoQueueNext()) ? claimNextJob(runnerName, kinds) : null;
}

/** GET /api/runner/next: claims one queued build, or 204 with why there's nothing to do. */
export async function claimNext(key: BotKey, request: Request) {
  const search = new URL(request.url).searchParams;
  const noBuilds = await whyNoBuilds();
  const kinds = kindsAllowed(search, noBuilds);
  if (kinds.length === 0) return idle(noBuilds ?? "Nothing to do.");
  const runnerName = search.get("runner")?.slice(0, 60) || key.name;
  const job = (await claimNextJob(runnerName, kinds)) ?? (noBuilds ? null : await claimAutoQueued(runnerName, kinds));
  if (!job) return idle(noBuilds ?? "Nothing queued, and no new lead with an email is waiting for a preview.");
  const lead = await leadForJob(job);
  await record(ACTOR, job.kind === "launch" ? "claimed a launch" : "claimed a preview build", { businessId: lead.id, detail: `${runnerName}, attempt ${job.attempts}` });
  return jobPayload(job, lead, checkoutLink(lead, await outreachSettings()));
}

async function claimedJob(id: string): Promise<PreviewJob> {
  const job = await jobById(id);
  if (!job) throw new BotError(404, "No preview job has that ID.");
  if (!isActive(job.status) || job.status === "queued") throw new BotError(409, `That job is ${job.status}, not claimed. Ask GET /next for work.`);
  return job;
}

export const ProgressBody = z.object({ started: z.boolean().default(false), step: z.string().trim().max(200).default("") });

/** POST /api/runner/:job/progress */
export async function reportProgress(id: string, body: z.infer<typeof ProgressBody>) {
  const job = await claimedJob(id);
  await updateJob(job.id, { status: "running", startedAt: job.startedAt ?? new Date(), step: body.step || job.step });
  return { ok: true };
}

export const DoneBody = z.object({
  status: z.enum(["done", "failed", "waiting_for_usage"]),
  previewUrl: z.url({ protocol: /^https$/ }).optional(),
  verifyPassed: z.boolean().optional(),
  worstCls: z.number().min(0).optional(),
  criticVerdict: z.string().trim().max(200).optional(),
  tokens: z.number().int().min(0).optional(),
  minutes: z.number().min(0).optional(),
  apiEquivalentUsd: z.number().min(0).optional(),
  logTail: z.string().max(LOG_TAIL_LIMIT * 4).optional(),
  resumeAt: z.iso.datetime({ offset: true }).optional(),
  launch: z
    .object({
      projectId: z.string().trim().min(1).max(100),
      liveUrl: z.url({ protocol: /^https$/ }),
      records: z.array(z.object({ host: z.string().max(253), type: z.enum(["A", "CNAME"]), name: z.string().max(253), value: z.string().max(253) })).max(4),
    })
    .optional(),
});
type Done = z.infer<typeof DoneBody>;

function results(body: Done) {
  return {
    finishedAt: new Date(),
    verifyPassed: body.verifyPassed ?? null,
    worstCls: body.worstCls ?? null,
    criticVerdict: body.criticVerdict ?? "",
    tokens: body.tokens ?? null,
    minutes: body.minutes ?? null,
    apiEquivalentUsd: body.apiEquivalentUsd ?? null,
    logTail: (body.logTail ?? "").slice(-LOG_TAIL_LIMIT),
  };
}

/** The design critic's last word was "revise": the preview goes up, but a founder looks before the owner does. */
const criticWantsRevision = (verdict: string | undefined) => /\brevise\b/i.test(verdict ?? "");

async function holdForReview(lead: Business, previewUrl: string, verdict: string) {
  await (await db()).insert(flags).values({
    bot: "runner" satisfies Bot,
    businessId: lead.id,
    priority: "review",
    whatHappened: `The design critic's verdict on ${lead.businessName}'s new preview is "${verdict}".`,
    whatBotDid: "Deployed the preview and kept the lead out of the outreach queue.",
    why: "The owner sees this preview in our first email, so a founder looks at it first. If it's fine, press Ready to send on the lead's page. If not, use Rebuild with a note.",
    link: previewUrl,
  });
  await record(ACTOR, "held a preview for review", { businessId: lead.id, detail: verdict });
}

async function finishBuilt(job: PreviewJob, lead: Business, body: Done) {
  if (!body.previewUrl) throw new BotError(400, "A finished build needs previewUrl, the deployed preview's https address.");
  await updateJob(job.id, { status: "done", previewUrl: body.previewUrl, step: "Deployed", ...results(body) });
  const held = lead.stage === "new" && criticWantsRevision(body.criticVerdict);
  const ready = lead.stage === "new" && !held ? { stage: "preview_built" as const } : {};
  await updateBusiness(lead.id, { previewUrl: body.previewUrl, previewBuiltAt: new Date(), ...ready });
  if (held) await holdForReview(lead, body.previewUrl, body.criticVerdict ?? "");
  const cost = body.apiEquivalentUsd === undefined ? "" : `, about $${body.apiEquivalentUsd.toFixed(2)} at API prices`;
  await record(ACTOR, "built a preview", { businessId: lead.id, detail: `${body.previewUrl}${cost}` });
  // A launched site's changes go live by launching again: the same project, redeployed.
  if (lead.vercelProjectId) await requestPreview(lead, ACTOR, "Redeploy with the changes just built.", "launch");
}

/** The address the site answers on once the owner connects their domain, or the Vercel one until then. */
function liveAddress(lead: Business, liveUrl: string) {
  const domain = launchDomainOf(lead);
  return domain ? `https://${domain}` : liveUrl;
}

async function finishLaunched(job: PreviewJob, lead: Business, body: Done) {
  if (!body.launch) throw new BotError(400, "A finished launch needs launch: { projectId, liveUrl, records }.");
  await updateJob(job.id, { status: "done", step: "Live", result: body.launch, ...results(body) });
  const siteUrl = liveAddress(lead, body.launch.liveUrl);
  await updateBusiness(lead.id, { vercelProjectId: body.launch.projectId, siteUrl, launchedAt: lead.launchedAt ?? new Date() });
  await addClientSite({ slug: lead.slug, ownerEmail: lead.ownerEmail || lead.email, url: siteUrl, businessId: lead.id, createdBy: ACTOR });
  const records = body.launch.records.map((entry) => `${entry.type} ${entry.name} → ${entry.value}`).join(", ");
  await record(ACTOR, "launched the site", { businessId: lead.id, detail: `${body.launch.liveUrl}; ${records}` });
}

function finishDone(job: PreviewJob, lead: Business, body: Done) {
  return job.kind === "launch" ? finishLaunched(job, lead, body) : finishBuilt(job, lead, body);
}

function lastLines(text: string, count: number) {
  return text.trim().split("\n").slice(-count).join("\n");
}

const RETRY_NOTE = "The last build of this site failed. Read verify/report.md and the latest design/critique-*.md, and fix every failure they list before anything else.";

/** A failed build tries once more by itself with a note pointing at what failed. After that, only a paying client's failure reaches a founder. */
async function retryOrGiveUp(job: PreviewJob, lead: Business, body: Done) {
  if (job.kind === "preview" && (await failuresInARow(lead.id)) < MAX_FAILED_BUILDS) {
    await requestPreview(lead, ACTOR, [job.note, RETRY_NOTE].filter(Boolean).join("\n\n"));
    return;
  }
  if (lead.paidAt) await flagFailure(job, lead, body);
  else await record(ACTOR, "gave up on a preview", { businessId: lead.id, detail: `${MAX_FAILED_BUILDS} builds in a row failed, so this lead is skipped.` });
}

async function finishFailed(job: PreviewJob, lead: Business, body: Done) {
  await updateJob(job.id, { status: "failed", step: "Failed", ...results(body) });
  await record(ACTOR, job.kind === "launch" ? "launch failed" : "preview build failed", { businessId: lead.id, detail: lastLines(body.logTail ?? "", 3) });
  await retryOrGiveUp(job, lead, body);
}

async function flagFailure(job: PreviewJob, lead: Business, body: Done) {
  await (await db()).insert(flags).values({
    bot: "runner" satisfies Bot,
    businessId: lead.id,
    priority: "review",
    whatHappened: `The preview build for ${lead.businessName} failed${body.verifyPassed === false ? " verification" : ""}.\n\n${lastLines(body.logTail ?? "", 12)}`,
    whatBotDid: "Stopped. Nothing was deployed; the lead keeps any earlier preview.",
    why: `A paying client's ${job.kind === "launch" ? "launch" : "build"} failed${job.kind === "launch" ? "" : " after a retry"}. Read the log on the runner machine, then use Rebuild with a note on the lead.`,
  });
}

async function finishWaiting(job: PreviewJob, lead: Business, body: Done) {
  const resume = body.resumeAt ? new Date(body.resumeAt) : new Date(Date.now() + PAUSE_WITHOUT_RESUME_MS);
  await updateJob(job.id, { status: "queued", step: "", claimedAt: null, startedAt: null, logTail: (body.logTail ?? "").slice(-LOG_TAIL_LIMIT) });
  await updateRunnerSettings({ pausedUntil: resume.toISOString() }, ACTOR);
  await record(ACTOR, "paused for Claude usage", { businessId: lead.id, detail: `Back in the queue; builds resume ${resume.toISOString()}` });
}

const FINISHERS: Record<Done["status"], (job: PreviewJob, lead: Business, body: Done) => Promise<void>> = {
  done: finishDone,
  failed: finishFailed,
  waiting_for_usage: finishWaiting,
};

/** POST /api/runner/:job/done */
export async function reportDone(id: string, body: Done) {
  const job = await claimedJob(id);
  await FINISHERS[body.status](job, await leadForJob(job), body);
  return { ok: true, status: body.status === "waiting_for_usage" ? "queued" : body.status };
}

export const RequestBody = z.preprocess((value) => value ?? {}, z.object({ note: z.string().trim().max(2000).default("") }));

/** POST /api/bot/leads/:id/request-preview, for the Outreach bot once a founder switches it on. */
export async function botRequestPreview(key: BotKey, id: string, body: z.infer<typeof RequestBody>) {
  if (key.bot !== "outreach") throw new BotError(403, "Only the Outreach bot requests previews.");
  if (!(await runnerSettings()).outreachPicksPreviews) throw new BotError(403, "Requesting previews isn't switched on for you yet. Leave it to the founders.");
  const lead = await ownedLead(key, id);
  const { job, created } = await requestPreview(lead, `bot:${key.bot}`, body.note);
  return { ok: true, jobId: job.id, status: job.status, alreadyQueued: !created };
}
