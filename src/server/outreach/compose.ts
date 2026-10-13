import "server-only";
import { asClause, fillTemplate, offerSentence, unfilledPlaceholders, type OutreachSettings, type TemplateValues } from "@/lib/emailTemplate";
import { replySubject } from "@/lib/emailLinks";
import type { Business } from "../db/schema";
import { env } from "../env";
import { isBlocked } from "../leads/contactKeys";

/** first and follow_up are cold email; requested goes to a business that asked us, from hello@defect.tech. */
export type EmailKind = "first" | "follow_up" | "requested";

/** The email thread a business asked us in, so the request email answers it there. */
export type RequestThread = { threadId: string | null; headerMessageId: string; subject: string };

export function previewLink(business: Business) {
  return new URL(`/p/${business.linkCode}`, env.siteUrl()).toString();
}

/** Where an owner who wants to go ahead learns how it works and signs up: the video, what's included and checkout. */
export function welcomeLink(business: Business) {
  return new URL(`/welcome/${business.linkCode}`, env.siteUrl()).toString();
}

export function templateValues(business: Business, settings: OutreachSettings, problem = business.emailProblem): TemplateValues {
  return {
    first_name: business.ownerFirstName || "there",
    business: business.businessName,
    problem: asClause(problem || business.problemSummary),
    link: previewLink(business),
    price: business.priceArm ? String(business.priceArm) : "{price}",
    offer: offerSentence(business.priceArm),
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

/** fixedByEditing marks what the founder covers by writing the email themselves: the address and the problem line. */
type Check = { failed: (b: Business, s: OutreachSettings, blocked: Set<string>) => boolean; fix: string; coldOnly?: boolean; fixedByEditing?: boolean };

/** Reasons an email can't go yet, each written as what to do about it. */
const CHECKS: Check[] = [
  { failed: (b) => !b.email, fix: "Add an email address for this business.", fixedByEditing: true },
  { failed: (b, _s, blocked) => isBlocked(blocked, b), fix: "This business opted out, so it can't be emailed." },
  { failed: (b) => !b.previewUrl, fix: "Build and deploy the preview first." },
  { failed: (b) => !b.priceArm, fix: "Pick $59 or $79 for this lead." },
  { failed: (b) => !(b.emailProblem || b.problemSummary), fix: "Write the problem line.", coldOnly: true, fixedByEditing: true },
  { failed: (_b, s) => !s.mailingAddress, fix: "Add the mailing address on the Template page. The law requires it." },
  { failed: (_b, s) => !s.senderName, fix: "Add the sender's name on the Template page.", coldOnly: true },
];

const OPT_OUT_NOTICE = /no thanks|unsubscribe|opt out/i;

/** CAN-SPAM: every sales email carries the sender's postal address and says how to stop the emails. */
const BODY_CHECKS: { failed: (body: string, s: OutreachSettings) => boolean; fix: string }[] = [
  { failed: (body, s) => Boolean(s.mailingAddress.trim()) && !body.includes(s.mailingAddress.trim()), fix: "Put the mailing address back in the email. The law requires it in every sales email." },
  { failed: (body) => !OPT_OUT_NOTICE.test(body), fix: 'Say how to stop the emails, such as: Not interested? Reply "no thanks" and we won\'t email again.' },
];

type CheckOptions = { kind?: EmailKind; edited?: boolean };

const applies = (check: Check, { kind = "first", edited = false }: CheckOptions) => !(kind === "requested" && check.coldOnly) && !(edited && check.fixedByEditing);

export function failingChecks(business: Business, settings: OutreachSettings, blocked: Set<string>, options: CheckOptions = {}): string[] {
  return CHECKS.filter((check) => applies(check, options) && check.failed(business, settings, blocked)).map((check) => check.fix);
}

export function blockers(business: Business, settings: OutreachSettings, blocked: Set<string>, body: string, options: CheckOptions = {}): string[] {
  const failing = [...failingChecks(business, settings, blocked, options), ...BODY_CHECKS.filter((check) => check.failed(body, settings)).map((check) => check.fix)];
  const leftovers = unfilledPlaceholders(body);
  if (leftovers.length > 0 && failing.length === 0) failing.push(`The email has unfilled placeholders: ${leftovers.join(", ")}.`);
  return failing;
}
