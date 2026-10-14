import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { FIXER_LABEL, type Fixer } from "@/lib/flags";
import { db } from "../db/client";
import { activity, flags, type Flag } from "../db/schema";
import { env } from "../env";
import { deliver } from "../mail/outbox";
import { STUDIO_NAME, studioMailboxId } from "../onboarding/welcome";
import type { FlagRow } from "../bots/flags";
import { spentToday } from "../runner/jobs";

const reviewLink = (flag?: Flag) => `${env.siteUrl()}/admin${flag ? `#flag-${flag.id}` : ""}`;

export async function emailFounders(subject: string, body: string) {
  const to = env.founderEmails().join(", ");
  if (!to) throw new Error("ADMIN_EMAILS is empty, so there's nobody to tell.");
  await deliver((from) => ({ from: { name: STUDIO_NAME, email: from?.email ?? "outbox@dev.localhost" }, to, subject, body }), await studioMailboxId());
}

/** Who acts on the card, as the email and the review queue both say it. */
export function whoActs(flag: Pick<Flag, "needs" | "fixer">): string {
  if (flag.needs === "decision") return "Needs a decision from either of you.";
  if (flag.fixer === "claude") return "Claude can fix this: press Hand to Claude on Today in the admin.";
  return `${FIXER_LABEL[flag.fixer as Fixer]} can fix this.`;
}

/** An urgent card, the moment it opens: what's wrong, what's needed, and where to answer it. */
export async function alertFounders(flag: Flag) {
  const body = [flag.headline, flag.ask, whoActs(flag), `Answer it here: ${reviewLink(flag)}`].filter(Boolean).join("\n\n");
  await emailFounders(`Needs you: ${flag.headline}`, body);
}

const LA_MIDNIGHT = sql`(date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles')`;

const COUNTED: [string, string[], (count: number) => string][] = [
  ["emails answered", ["replied"], (n) => `${n} ${n === 1 ? "email" : "emails"} answered`],
  ["previews built", ["built a preview"], (n) => `${n} ${n === 1 ? "preview" : "previews"} built`],
  ["new clients", ["paid"], (n) => `${n} new ${n === 1 ? "client" : "clients"}`],
  ["launches", ["launched the site"], (n) => `${n} ${n === 1 ? "site" : "sites"} launched`],
];

async function todaysCounts(): Promise<string> {
  const rows = await (await db())
    .select({ action: activity.action, count: sql<number>`count(*)::int` })
    .from(activity)
    .where(and(gte(activity.at, LA_MIDNIGHT), inArray(activity.action, COUNTED.flatMap(([, actions]) => actions))))
    .groupBy(activity.action);
  const countOf = (actions: string[]) => rows.filter((row) => actions.includes(row.action)).reduce((sum, row) => sum + row.count, 0);
  const spent = await spentToday();
  const builds = spent > 0 ? ` Builds used about $${spent.toFixed(2)} of Claude at API prices.` : "";
  return `Today: ${COUNTED.map(([, actions, phrase]) => phrase(countOf(actions))).join(", ")}.${builds}`;
}

const line = ({ flag, businessName }: FlagRow) => `- ${flag.headline || flag.whatHappened.split("\n")[0]}${businessName && !flag.headline.includes(businessName) ? ` (${businessName})` : ""}`;

const whoShort = (flag: Flag) => (flag.needs === "decision" ? "needs a decision" : `${FIXER_LABEL[flag.fixer as Fixer]} can fix it`);

function needsYouSection(open: FlagRow[]): string[] {
  if (open.length === 0) return ["Nothing needs you today."];
  return ["Needs you", ...open.map((row) => `${line(row)} (${whoShort(row.flag)})`), reviewLink()];
}

/** The evening email's text, built from the review queue instead of written by a bot. */
export function digestEmail(open: FlagRow[], fyis: FlagRow[], counts: string, now = new Date()) {
  const date = now.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" });
  const needs = open.length === 0 ? "nothing needs you" : `${open.length} ${open.length === 1 ? "thing needs" : "things need"} you`;
  const sections = [needsYouSection(open), fyis.length ? ["For your information", ...fyis.map(line)] : [], [counts]];
  return { subject: `${STUDIO_NAME}, ${date}: ${needs}`, body: sections.filter((section) => section.length).map((section) => section.join("\n")).join("\n\n") };
}

/** Sends the evening email. The FYIs it mentions are closed, since that's all they needed. */
export async function sendDigest(open: FlagRow[], fyis: FlagRow[]) {
  const { subject, body } = digestEmail(open, fyis, await todaysCounts());
  await emailFounders(subject, body);
  if (fyis.length) {
    await (await db())
      .update(flags)
      .set({ status: "closed", note: "Sent in the evening digest.", reviewer: "digest", resolvedAt: new Date() })
      .where(and(eq(flags.status, "open"), inArray(flags.id, fyis.map((row) => row.flag.id))));
  }
  return { needsYou: open.length, fyis: fyis.length };
}
