import "server-only";
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { canMove, type Bot } from "@/lib/bots";
import { STAGES, type Stage } from "@/lib/stages";
import { record } from "../activity";
import { db } from "../db/client";
import { activity, businesses, messages, type Business, type BotKey } from "../db/schema";
import { businessById, optOut, updateBusiness } from "../leads/businesses";
import { actorOf, BotError } from "./http";

const NOTE_ACTIONS = ["note", "handoff note"];

/** What a bot sees of a lead. Stripe IDs and internal codes stay out. */
function leadView(lead: Business) {
  return {
    id: lead.id,
    slug: lead.slug,
    businessName: lead.businessName,
    website: lead.website,
    email: lead.email,
    ownerEmail: lead.ownerEmail,
    ownerFirstName: lead.ownerFirstName,
    stage: lead.stage,
    priceArm: lead.priceArm,
    plan: lead.plan,
    previewUrl: lead.previewUrl,
    siteUrl: lead.siteUrl,
    problem: lead.emailProblem || lead.problemSummary,
    note: lead.note,
    firstSentAt: lead.firstSentAt,
    clickedAt: lead.clickedAt,
    repliedAt: lead.repliedAt,
    paidAt: lead.paidAt,
    launchedAt: lead.launchedAt,
  };
}

export const LeadQuery = z.object({
  stage: z.enum(STAGES).optional(),
  email: z.string().trim().toLowerCase().max(200).optional(),
  q: z.string().trim().max(100).optional(),
});

function visibleStages(key: BotKey, stage?: Stage): Stage[] {
  if (!stage) return key.stages;
  if (!key.stages.includes(stage)) throw new BotError(403, `Leads at stage ${stage} belong to another bot. Yours are: ${key.stages.join(", ")}.`);
  return [stage];
}

function searchClause({ email, q }: z.infer<typeof LeadQuery>) {
  const byEmail = email ? or(eq(businesses.email, email), eq(businesses.ownerEmail, email)) : undefined;
  const like = q ? `%${q}%` : "";
  const byText = q ? or(ilike(businesses.businessName, like), ilike(businesses.website, like), ilike(businesses.slug, like)) : undefined;
  return and(byEmail, byText);
}

export async function listLeads(key: BotKey, query: z.infer<typeof LeadQuery>) {
  const rows = await (await db())
    .select()
    .from(businesses)
    .where(and(inArray(businesses.stage, visibleStages(key, query.stage)), searchClause(query)))
    .orderBy(desc(businesses.updatedAt))
    .limit(100);
  return { leads: rows.map(leadView) };
}

/** The lead, if it exists and sits in one of this bot's stages. */
async function ownedLead(key: BotKey, id: string): Promise<Business> {
  const lead = await businessById(id);
  if (!lead) throw new BotError(404, "No lead has that ID.");
  if (!key.stages.includes(lead.stage)) throw new BotError(403, `This lead is at stage ${lead.stage}, which belongs to another bot. Leave it alone.`);
  return lead;
}

export async function leadDetail(key: BotKey, id: string) {
  const lead = await ownedLead(key, id);
  const database = await db();
  const [thread, history] = await Promise.all([
    database
      .select({ direction: messages.direction, from: messages.fromAddress, to: messages.toAddress, subject: messages.subject, body: messages.body, at: messages.at })
      .from(messages)
      .where(eq(messages.businessId, id))
      .orderBy(asc(messages.at)),
    database.select().from(activity).where(eq(activity.businessId, id)).orderBy(desc(activity.at)).limit(50),
  ]);
  const notes = history.filter((entry) => NOTE_ACTIONS.includes(entry.action)).map(({ at, actor, action, detail }) => ({ at, by: actor, handoff: action === "handoff note", text: detail }));
  return { lead: leadView(lead), messages: thread, notes, activity: history.map(({ at, actor, action, detail }) => ({ at, actor, action, detail })) };
}

export const NoteBody = z.object({ text: z.string().trim().min(1).max(4000), handoff: z.boolean().default(false) });

export async function addNote(key: BotKey, id: string, body: z.infer<typeof NoteBody>) {
  const lead = await ownedLead(key, id);
  await record(actorOf(key), body.handoff ? "handoff note" : "note", { businessId: lead.id, detail: body.text });
  return { ok: true };
}

export const StageBody = z.object({
  to: z.enum(STAGES),
  siteUrl: z.url({ protocol: /^https$/ }).optional(),
  note: z.string().trim().max(4000).optional(),
});

const STAGE_EFFECTS: Partial<Record<Stage, (lead: Business, body: z.infer<typeof StageBody>, reason: string) => Promise<void>>> = {
  opted_out: (lead, _body, reason) => optOut(lead, reason),
  live: (lead, body) => updateBusiness(lead.id, { stage: "live", siteUrl: body.siteUrl, launchedAt: new Date() }),
};

async function applyStage(lead: Business, body: z.infer<typeof StageBody>, actor: string) {
  const effect = STAGE_EFFECTS[body.to];
  if (effect) return effect(lead, body, body.note ?? `marked by ${actor}`);
  await updateBusiness(lead.id, { stage: body.to });
}

export async function moveStage(key: BotKey, id: string, body: z.infer<typeof StageBody>) {
  const lead = await ownedLead(key, id);
  const bot = key.bot as Bot;
  if (!canMove(bot, lead.stage, body.to)) throw new BotError(403, `You can't move a lead from ${lead.stage} to ${body.to}. Flag it for a founder instead.`);
  if (body.to === "live" && !body.siteUrl) throw new BotError(400, "Moving a lead to live needs siteUrl, the live https address.");
  const actor = actorOf(key);
  if (body.note) await record(actor, "handoff note", { businessId: lead.id, detail: body.note });
  await applyStage(lead, body, actor);
  await record(actor, `moved to ${body.to}`, { businessId: lead.id, detail: body.siteUrl ?? "" });
  return { ok: true, stage: body.to };
}
