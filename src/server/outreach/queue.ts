import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import type { OutreachSettings, TemplateValues } from "@/lib/emailTemplate";
import { db } from "../db/client";
import { businesses, messages, type Business } from "../db/schema";
import { blockedContacts } from "../leads/businesses";
import { outreachSettings } from "../settings";
import { requestThreads } from "../inbound/threads";
import { PACIFIC_MIDNIGHT } from "./pacificDay";
import { expiredPreviewIds } from "../leads/previewExpiry";
import { blockers, composeBody, failingChecks, composeSubject, firstKindFor, templateFor, templateValues, type EmailKind, type RequestThread, type SendContext } from "./compose";

export type QueueItem = {
  business: Business;
  kind: EmailKind;
  subject: string;
  body: string;
  template: string;
  values: TemplateValues;
  blockers: string[];
  /** What still stops the email once the founder writes it themselves. */
  editBlockers: string[];
};

const DAY = 24 * 60 * 60 * 1000;

/** First emails and follow-ups both count toward the daily limit. Request emails don't: those businesses asked us. */
export async function sentToday(): Promise<number> {
  const [row] = await (await db())
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.direction, "out"), or(eq(messages.kind, "first"), eq(messages.kind, "follow_up")), gte(messages.at, PACIFIC_MIDNIGHT)));
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
        eq(businesses.source, "lead_finder"),
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

type ItemContext = { settings: OutreachSettings; send: SendContext; firstSubject?: string; thread?: RequestThread };

function toItem(kind: EmailKind, business: Business, { settings, send, firstSubject = "", thread }: ItemContext): QueueItem {
  const body = composeBody(kind, business, settings);
  return {
    business,
    kind,
    subject: composeSubject(kind, business, settings, firstSubject, thread),
    body,
    template: templateFor(kind, settings),
    values: templateValues(business, settings),
    blockers: blockers(business, settings, send, body, { kind }),
    editBlockers: failingChecks(business, settings, send, { kind, edited: true }),
  };
}

export async function outreachQueue() {
  const settings = await outreachSettings();
  const [ready, due, blocked, sent, expired] = await Promise.all([readyForFirstEmail(), dueForFollowUp(settings), blockedContacts(), sentToday(), expiredPreviewIds()]);
  const send = { blocked, expired };
  const requested = ready.filter((b) => firstKindFor(b) === "requested");
  const [subjects, threads] = await Promise.all([firstSubjects(due.map((b) => b.id)), requestThreads(requested.map((b) => b.id))]);
  return {
    settings,
    sentToday: sent,
    requested: requested.map((b) => toItem("requested", b, { settings, send, thread: threads.get(b.id) })),
    followUps: due.map((b) => toItem("follow_up", b, { settings, send, firstSubject: subjects.get(b.id) })),
    firstEmails: ready.filter((b) => firstKindFor(b) === "first").map((b) => toItem("first", b, { settings, send })),
  };
}
