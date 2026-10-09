import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import type { OutreachSettings, TemplateValues } from "@/lib/emailTemplate";
import { db } from "../db/client";
import { businesses, messages, type Business } from "../db/schema";
import { blockedDomains } from "../leads/businesses";
import { outreachSettings } from "../settings";
import { blockers, composeBody, composeSubject, templateValues, type EmailKind } from "./compose";

export type QueueItem = {
  business: Business;
  kind: EmailKind;
  subject: string;
  body: string;
  template: string;
  values: TemplateValues;
  blockers: string[];
};

const DAY = 24 * 60 * 60 * 1000;

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** First emails and follow-ups both count toward the daily limit. */
export async function sentToday(): Promise<number> {
  const [row] = await (await db())
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.direction, "out"), or(eq(messages.kind, "first"), eq(messages.kind, "follow_up")), gte(messages.at, startOfToday())));
  return row?.count ?? 0;
}

async function readyForFirstEmail() {
  return (await db())
    .select()
    .from(businesses)
    .where(and(eq(businesses.stage, "preview_built"), isNull(businesses.firstSentAt)))
    .orderBy(asc(businesses.previewBuiltAt));
}

/** Sent long enough ago, no reply, no follow-up yet, and still in play. */
async function dueForFollowUp(settings: OutreachSettings) {
  const cutoff = new Date(Date.now() - settings.followUpAfterDays * DAY);
  return (await db())
    .select()
    .from(businesses)
    .where(
      and(
        isNotNull(businesses.firstSentAt),
        lte(businesses.firstSentAt, cutoff),
        isNull(businesses.followUpSentAt),
        isNull(businesses.repliedAt),
        or(eq(businesses.stage, "sent"), eq(businesses.stage, "clicked")),
      ),
    )
    .orderBy(asc(businesses.firstSentAt));
}

async function firstSubjects(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await (await db())
    .select({ businessId: messages.businessId, subject: messages.subject })
    .from(messages)
    .where(and(eq(messages.kind, "first"), inArray(messages.businessId, ids)));
  return new Map(rows.map((row) => [row.businessId, row.subject]));
}

function toItem(kind: EmailKind, business: Business, settings: OutreachSettings, blocked: Set<string>, firstSubject = ""): QueueItem {
  const body = composeBody(kind, business, settings);
  return {
    business,
    kind,
    subject: composeSubject(kind, business, settings, firstSubject),
    body,
    template: kind === "first" ? settings.firstEmail : settings.followUp,
    values: templateValues(business, settings),
    blockers: blockers(business, settings, blocked, body),
  };
}

export async function outreachQueue() {
  const settings = await outreachSettings();
  const [ready, due, blocked, sent] = await Promise.all([readyForFirstEmail(), dueForFollowUp(settings), blockedDomains(), sentToday()]);
  const subjects = await firstSubjects(due.map((b) => b.id));
  return {
    settings,
    sentToday: sent,
    followUps: due.map((b) => toItem("follow_up", b, settings, blocked, subjects.get(b.id))),
    firstEmails: ready.map((b) => toItem("first", b, settings, blocked)),
  };
}
