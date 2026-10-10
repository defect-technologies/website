import "server-only";
import { desc, eq, inArray, isNotNull, like, max } from "drizzle-orm";
import { BOTS, type Bot } from "@/lib/bots";
import { leadStatus, type LeadStatus } from "@/lib/leadStatus";
import { db } from "./db/client";
import { activity, botCalls, businesses, messages, previewJobs, type Activity, type BotKey, type Business, type Message, type PreviewJob } from "./db/schema";
import { listBotKeys } from "./bots/keys";
import { stripeSummary } from "./integrations/stripe";
import { funnelByArm } from "./leads/businesses";
import { buildsToday, spentToday } from "./runner/jobs";
import { activePause, runnerSettings } from "./runner/settings";

export type LastEmail = Pick<Message, "at" | "direction" | "sentBy" | "subject">;
export type LeadRow = { lead: Business; job: PreviewJob | null; lastEmail: LastEmail | null; status: LeadStatus };

async function latestJobs(): Promise<Map<string, PreviewJob>> {
  const rows = await (await db())
    .selectDistinctOn([previewJobs.businessId])
    .from(previewJobs)
    .orderBy(previewJobs.businessId, desc(previewJobs.createdAt));
  return new Map(rows.map((job) => [job.businessId, job]));
}

async function lastEmails(): Promise<Map<string, LastEmail>> {
  const rows = await (await db())
    .selectDistinctOn([messages.businessId], { businessId: messages.businessId, at: messages.at, direction: messages.direction, sentBy: messages.sentBy, subject: messages.subject })
    .from(messages)
    .orderBy(messages.businessId, desc(messages.at));
  return new Map(rows.map(({ businessId, ...email }) => [businessId, email]));
}

/** Every business with its latest build and email. Live ones are clients; the rest are leads. */
export async function sheetRows(): Promise<{ leads: LeadRow[]; clients: LeadRow[] }> {
  const [all, jobs, emails] = await Promise.all([(await db()).select().from(businesses).orderBy(desc(businesses.updatedAt)), latestJobs(), lastEmails()]);
  const rows = all.map((lead) => {
    const job = jobs.get(lead.id) ?? null;
    return { lead, job, lastEmail: emails.get(lead.id) ?? null, status: leadStatus(lead.stage, job?.status ?? null) };
  });
  return { leads: rows.filter((row) => row.lead.stage !== "live"), clients: rows.filter((row) => row.lead.stage === "live") };
}

export type EmailRow = Message & { businessName: string };

export async function recentEmails(limit = 300): Promise<EmailRow[]> {
  const rows = await (await db())
    .select({ message: messages, businessName: businesses.businessName })
    .from(messages)
    .innerJoin(businesses, eq(messages.businessId, businesses.id))
    .orderBy(desc(messages.at))
    .limit(limit);
  return rows.map(({ message, businessName }) => ({ ...message, businessName }));
}

export type ActivityRow = Activity & { businessName: string | null };

export async function recentActivity(limit = 300): Promise<ActivityRow[]> {
  const rows = await (await db())
    .select({ entry: activity, businessName: businesses.businessName })
    .from(activity)
    .leftJoin(businesses, eq(activity.businessId, businesses.id))
    .orderBy(desc(activity.at))
    .limit(limit);
  return rows.map(({ entry, businessName }) => ({ ...entry, businessName }));
}

export type AgentState = {
  bot: Bot;
  keys: BotKey[];
  lastCallAt: Date | null;
  lastAction: ActivityRow | null;
  /** The runner's builds in progress. Bots report no current task, only their last call and action. */
  building: (PreviewJob & { businessName: string })[];
};

async function lastCallByBot(): Promise<Map<string, Date>> {
  const rows = await (await db())
    .select({ bot: botCalls.bot, at: max(botCalls.at) })
    .from(botCalls)
    .where(isNotNull(botCalls.bot))
    .groupBy(botCalls.bot);
  return new Map(rows.filter((row) => row.bot && row.at).map((row) => [row.bot as string, row.at as Date]));
}

async function lastActionByBot(): Promise<Map<string, ActivityRow>> {
  const rows = await (await db())
    .selectDistinctOn([activity.actor], { entry: activity, businessName: businesses.businessName })
    .from(activity)
    .leftJoin(businesses, eq(activity.businessId, businesses.id))
    .where(like(activity.actor, "bot:%"))
    .orderBy(activity.actor, desc(activity.at));
  return new Map(rows.map(({ entry, businessName }) => [entry.actor.slice("bot:".length), { ...entry, businessName }]));
}

async function buildsInProgress() {
  const rows = await (await db())
    .select({ job: previewJobs, businessName: businesses.businessName })
    .from(previewJobs)
    .innerJoin(businesses, eq(previewJobs.businessId, businesses.id))
    .where(inArray(previewJobs.status, ["claimed", "running"]))
    .orderBy(desc(previewJobs.claimedAt));
  return rows.map(({ job, businessName }) => ({ ...job, businessName }));
}

export async function agentStates(): Promise<AgentState[]> {
  const [keys, calls, actions, building] = await Promise.all([listBotKeys(), lastCallByBot(), lastActionByBot(), buildsInProgress()]);
  const live = keys.filter((key) => !key.revokedAt);
  return BOTS.map((bot) => ({
    bot,
    keys: live.filter((key) => key.bot === bot),
    lastCallAt: calls.get(bot) ?? null,
    lastAction: actions.get(bot) ?? null,
    building: bot === "runner" ? building : [],
  }));
}

export type RunnerDay = { settings: Awaited<ReturnType<typeof runnerSettings>>; built: number; spent: number; pausedUntil: Date | null };

async function runnerDay(): Promise<RunnerDay> {
  const [settings, built, spent] = await Promise.all([runnerSettings(), buildsToday(), spentToday()]);
  return { settings, built, spent, pausedUntil: activePause(settings) };
}

/** Everything the Overview shows, read at one moment so "working now" and "updated" agree. */
export async function overview() {
  const [agents, sheets, emails, events, runner, money, arms] = await Promise.all([agentStates(), sheetRows(), recentEmails(), recentActivity(), runnerDay(), stripeSummary(), funnelByArm()]);
  return { agents, ...sheets, emails, activity: events, runner, money, arms, readAt: Date.now() };
}
