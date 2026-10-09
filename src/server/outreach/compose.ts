import "server-only";
import { asClause, fillTemplate, unfilledPlaceholders, type OutreachSettings, type TemplateValues } from "@/lib/emailTemplate";
import type { Business } from "../db/schema";
import { env } from "../env";
import { domainOf } from "../mail/mime";

export type EmailKind = "first" | "follow_up";

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

export function composeBody(kind: EmailKind, business: Business, settings: OutreachSettings, problem?: string) {
  const template = kind === "first" ? settings.firstEmail : settings.followUp;
  return fillTemplate(template, templateValues(business, settings, problem));
}

export function composeSubject(kind: EmailKind, business: Business, settings: OutreachSettings, firstSubject = "") {
  if (kind === "follow_up" && firstSubject) return firstSubject.startsWith("Re:") ? firstSubject : `Re: ${firstSubject}`;
  return fillTemplate(settings.subject, templateValues(business, settings));
}

type Check = { failed: (b: Business, s: OutreachSettings, blocked: Set<string>) => boolean; fix: string };

/** Reasons an email can't go yet, each written as what to do about it. */
const CHECKS: Check[] = [
  { failed: (b) => !b.email, fix: "Add an email address for this business." },
  { failed: (b, _s, blocked) => blocked.has(domainOf(b.email)), fix: "This domain opted out. Nobody there can be emailed." },
  { failed: (b) => !b.previewUrl, fix: "Build and deploy the preview first." },
  { failed: (b) => !b.priceArm, fix: "Pick $59 or $79 for this lead." },
  { failed: (b) => !(b.emailProblem || b.problemSummary), fix: "Write the problem line." },
  { failed: (_b, s) => !s.mailingAddress, fix: "Add the mailing address on the Template page. The law requires it." },
  { failed: (_b, s) => !s.senderName, fix: "Add the sender's name on the Template page." },
];

export function blockers(business: Business, settings: OutreachSettings, blocked: Set<string>, body: string): string[] {
  const failing = CHECKS.filter((check) => check.failed(business, settings, blocked)).map((check) => check.fix);
  const leftovers = unfilledPlaceholders(body);
  if (leftovers.length > 0 && failing.length === 0) failing.push(`The template has unknown placeholders: ${leftovers.join(", ")}.`);
  return failing;
}
