import "server-only";
import { asClause, fillTemplate, unfilledPlaceholders, type OutreachSettings, type TemplateValues } from "@/lib/emailTemplate";
import { replySubject } from "@/lib/emailLinks";
import type { Business } from "../db/schema";
import { env } from "../env";
import { domainOf } from "../mail/mime";

/** first and follow_up are cold email; requested goes to a business that asked us, from hello@defect.tech. */
export type EmailKind = "first" | "follow_up" | "requested";

/** The email thread a business asked us in, so the request email answers it there. */
export type RequestThread = { threadId: string | null; headerMessageId: string; subject: string };

export function previewLink(business: Business) {
  return new URL(`/p/${business.linkCode}`, env.siteUrl()).toString();
}

export function templateValues(business: Business, settings: OutreachSettings, problem = business.emailProblem): TemplateValues {
  return {
    first_name: business.ownerFirstName || "there",
    business: business.businessName,
    problem: asClause(problem || business.problemSummary),
    link: previewLink(business),
    price: business.priceArm ? String(business.priceArm) : "{price}",
    sender: settings.senderName,
    address: settings.mailingAddress || "{address}",
  };
}

const TEMPLATE: Record<EmailKind, (settings: OutreachSettings) => string> = {
  first: (settings) => settings.firstEmail,
  follow_up: (settings) => settings.followUp,
  requested: (settings) => settings.requestEmail,
};

export const templateFor = (kind: EmailKind, settings: OutreachSettings) => TEMPLATE[kind](settings);

/** A business we found gets the cold email; one that asked us gets the request email. */
export const firstKindFor = (business: Business): EmailKind => (business.source === "request" ? "requested" : "first");

export function composeBody(kind: EmailKind, business: Business, settings: OutreachSettings, problem?: string) {
  return fillTemplate(templateFor(kind, settings), templateValues(business, settings, problem));
}

export function composeSubject(kind: EmailKind, business: Business, settings: OutreachSettings, firstSubject = "", thread: RequestThread | null = null) {
  if (kind === "follow_up" && firstSubject) return replySubject(firstSubject);
  if (kind === "requested") return thread?.subject ? replySubject(thread.subject) : fillTemplate(settings.requestSubject, templateValues(business, settings));
  return fillTemplate(settings.subject, templateValues(business, settings));
}

type Check = { failed: (b: Business, s: OutreachSettings, blocked: Set<string>) => boolean; fix: string; coldOnly?: boolean };

/** Reasons an email can't go yet, each written as what to do about it. */
const CHECKS: Check[] = [
  { failed: (b) => !b.email, fix: "Add an email address for this business." },
  { failed: (b, _s, blocked) => blocked.has(domainOf(b.email)), fix: "This domain opted out. Nobody there can be emailed." },
  { failed: (b) => !b.previewUrl, fix: "Build and deploy the preview first." },
  { failed: (b) => !b.priceArm, fix: "Pick $59 or $79 for this lead." },
  { failed: (b) => !(b.emailProblem || b.problemSummary), fix: "Write the problem line.", coldOnly: true },
  { failed: (_b, s) => !s.mailingAddress, fix: "Add the mailing address on the Template page. The law requires it.", coldOnly: true },
  { failed: (_b, s) => !s.senderName, fix: "Add the sender's name on the Template page.", coldOnly: true },
];

export function blockers(business: Business, settings: OutreachSettings, blocked: Set<string>, body: string, kind: EmailKind = "first"): string[] {
  const checks = kind === "requested" ? CHECKS.filter((check) => !check.coldOnly) : CHECKS;
  const failing = checks.filter((check) => check.failed(business, settings, blocked)).map((check) => check.fix);
  const leftovers = unfilledPlaceholders(body);
  if (leftovers.length > 0 && failing.length === 0) failing.push(`The template has unknown placeholders: ${leftovers.join(", ")}.`);
  return failing;
}
