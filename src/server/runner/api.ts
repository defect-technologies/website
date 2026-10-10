import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Bot } from "@/lib/bots";
import { record } from "../activity";
import { db } from "../db/client";
import { flags, type BotKey, type Business, type PreviewJob } from "../db/schema";
import { BotError } from "../bots/http";
import { ownedLead } from "../bots/leads";
import { checkoutLink } from "../leads/buildCommand";
import { updateBusiness } from "../leads/businesses";
import { outreachSettings } from "../settings";
import { autoQueueNext, buildsToday, claimNextJob, isActive, jobById, leadForJob, requestPreview, updateJob } from "./jobs";
import { activePause, runnerSettings, updateRunnerSettings } from "./settings";

const ACTOR = "bot:runner";
const PAUSE_WITHOUT_RESUME_MS = 60 * 60 * 1000;
const LOG_TAIL_LIMIT = 8000;

/** No work for the runner, with the reason in a header it can log. */
function idle(reason: string) {
  return new NextResponse(null, { status: 204, headers: { "X-Runner-Reason": reason } });
}

async function whyIdle(): Promise<string | null> {
  const current = await runnerSettings();
  const pause = activePause(current);
  if (pause) return `Paused until ${pause.toISOString()} after Claude's usage limit.`;
  const today = await buildsToday();
  if (today >= current.dailyCap) return `Daily cap reached: ${today} of ${current.dailyCap} builds today (Pacific).`;
  return null;
}

function jobPayload(job: PreviewJob, lead: Business, checkoutUrl: string) {
  return {
    job: { id: job.id, attempt: job.attempts, note: job.note },
    lead: { id: lead.id, slug: lead.slug, businessName: lead.businessName, website: lead.website, priceArm: lead.priceArm ?? 59, checkoutUrl },
  };
}

async function claimAutoQueued(runnerName: string): Promise<PreviewJob | null> {
  if (!(await runnerSettings()).autoQueue) return null;
  return (await autoQueueNext()) ? claimNextJob(runnerName) : null;
}

/** GET /api/runner/next: claims one queued build, or 204 with why there's nothing to do. */
export async function claimNext(key: BotKey, request: Request) {
  const reason = await whyIdle();
  if (reason) return idle(reason);
  const runnerName = new URL(request.url).searchParams.get("runner")?.slice(0, 60) || key.name;
  const job = (await claimNextJob(runnerName)) ?? (await claimAutoQueued(runnerName));
  if (!job) return idle("Nothing queued, and no new lead with an email is waiting for a preview.");
  const lead = await leadForJob(job);
  await record(ACTOR, "claimed a preview build", { businessId: lead.id, detail: `${runnerName}, attempt ${job.attempts}` });
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

async function finishBuilt(job: PreviewJob, lead: Business, body: Done) {
  if (!body.previewUrl) throw new BotError(400, "A finished build needs previewUrl, the deployed preview's https address.");
  await updateJob(job.id, { status: "done", previewUrl: body.previewUrl, step: "Deployed", ...results(body) });
  await updateBusiness(lead.id, { previewUrl: body.previewUrl, previewBuiltAt: new Date(), ...(lead.stage === "new" ? { stage: "preview_built" as const } : {}) });
  const cost = body.apiEquivalentUsd === undefined ? "" : `, about $${body.apiEquivalentUsd.toFixed(2)} at API prices`;
  await record(ACTOR, "built a preview", { businessId: lead.id, detail: `${body.previewUrl}${cost}` });
}

function lastLines(text: string, count: number) {
  return text.trim().split("\n").slice(-count).join("\n");
}

async function finishFailed(job: PreviewJob, lead: Business, body: Done) {
  await updateJob(job.id, { status: "failed", step: "Failed", ...results(body) });
  await (await db()).insert(flags).values({
    bot: "runner" satisfies Bot,
    businessId: lead.id,
    priority: "review",
    whatHappened: `The preview build for ${lead.businessName} failed${body.verifyPassed === false ? " verification" : ""}.\n\n${lastLines(body.logTail ?? "", 12)}`,
    whatBotDid: "Stopped. Nothing was deployed; the lead keeps any earlier preview.",
    why: "A build failed. Read the log on the runner machine, then use Rebuild preview or Rebuild with a note on the lead.",
  });
  await record(ACTOR, "preview build failed", { businessId: lead.id, detail: lastLines(body.logTail ?? "", 3), priority: "review" });
}

async function finishWaiting(job: PreviewJob, lead: Business, body: Done) {
  const resume = body.resumeAt ? new Date(body.resumeAt) : new Date(Date.now() + PAUSE_WITHOUT_RESUME_MS);
  await updateJob(job.id, { status: "queued", step: "", claimedAt: null, startedAt: null, logTail: (body.logTail ?? "").slice(-LOG_TAIL_LIMIT) });
  await updateRunnerSettings({ pausedUntil: resume.toISOString() }, ACTOR);
  await record(ACTOR, "paused for Claude usage", { businessId: lead.id, detail: `Back in the queue; builds resume ${resume.toISOString()}` });
}

const FINISHERS: Record<Done["status"], (job: PreviewJob, lead: Business, body: Done) => Promise<void>> = {
  done: finishBuilt,
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
