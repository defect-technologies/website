/** Shared by the server, which sends with it, and the template editor, which previews with it. */

export const PLACEHOLDERS = {
  first_name: "The owner's first name, or \"there\" when we don't know it",
  business: "The business name",
  problem: "The problem on their current site, as the preview builder wrote it",
  link: "The link to their preview",
  price: "The lead's monthly price, 59 or 79",
  offer: "For a lead at $59, the sentence saying our usual price is $79 and they keep $59. Empty at $79",
  sender: "Who the email is from",
  address: "The mailing address CAN-SPAM requires",
} as const;

export type Placeholder = keyof typeof PLACEHOLDERS;

/** Our price. $59 is a limited-time offer some leads get; they keep it for as long as they stay. A $79 lead never hears about it. */
export const REGULAR_MONTHLY_PRICE = 79;

/** Follows the price for a lead on the offer, and is empty for everyone else. */
export function offerSentence(priceArm: number | null): string {
  if (!priceArm || priceArm >= REGULAR_MONTHLY_PRICE) return "";
  return ` Our usual price is $${REGULAR_MONTHLY_PRICE}, but you'll keep $${priceArm} for as long as you stay with us.`;
}
export type TemplateValues = Record<Placeholder, string>;

export type OutreachSettings = {
  subject: string;
  firstEmail: string;
  followUp: string;
  /** To a business that asked us for a website. Sent from hello@defect.tech as the team, so it has no {sender}; it still needs {address} and a way to opt out. */
  requestSubject: string;
  requestEmail: string;
  senderName: string;
  mailingAddress: string;
  dailyLimit: number;
  followUpAfterDays: number;
};

export const DEFAULT_SETTINGS: OutreachSettings = {
  subject: "A new website for {business}",
  firstEmail: [
    "Hi {first_name},",
    "",
    "I was looking at {business}'s website and noticed {problem}. I made you a new version to show what it could look like: {link}",
    "",
    "If you like it, it's ${price} a month to keep it live, with no setup fee. That covers hosting and the changes you ask for.{offer} When your hours or prices change, reply to one of our emails and we'll usually have it updated the same day.",
    "",
    "What do you think?",
    "",
    "Warmly,",
    "{sender}",
    "This is a sales email from Defect Technologies, {address}.",
    "Not interested? Reply \"no thanks\" and we won't email again.",
  ].join("\n"),
  followUp: [
    "Hi {first_name}, just wanted to bump this to the top of your inbox in case it got lost :)",
    "",
    "Here's the new version of {business}'s website again: {link}",
    "",
    "If you'd like a change before deciding, tell me what to fix and I'll send you an updated link.",
    "",
    "Warmly,",
    "{sender}",
    "This is a sales email from Defect Technologies, {address}.",
    "Not interested? Reply \"no thanks\" and we won't email again.",
  ].join("\n"),
  requestSubject: "The new website for {business}",
  requestEmail: [
    "Hi {first_name}, thanks for asking us to build a website for {business}. Here it is: {link}",
    "",
    "If you like it, it's ${price} a month to keep it live, with no setup fee. That covers hosting and the changes you ask for.{offer} When your hours or prices change, reply to one of our emails and we'll usually have it updated the same day.",
    "",
    "Warmly,",
    "The Defect Technologies team",
    "hello@defect.tech",
    "Defect Technologies, {address}",
    "Don't want emails about this? Reply \"no thanks\" and we'll stop.",
  ].join("\n"),
  senderName: "Brendan Giang",
  mailingAddress: "",
  dailyLimit: 10,
  followUpAfterDays: 4,
};

export function fillTemplate(template: string, values: Partial<TemplateValues>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name as Placeholder] ?? match);
}

/** Placeholders a template uses that we have no value for. */
export function unfilledPlaceholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
}

/**
 * The preview builder writes the problem as a sentence ("Your site still says
 * © 2019."). The email drops it in after "Hi Maria, ", so it becomes a clause.
 */
export function asClause(problem: string): string {
  const trimmed = problem.trim().replace(/[.!]+$/, "");
  const startsWithAcronymOrI = /^(I\b|[A-Z]{2,})/.test(trimmed);
  return startsWithAcronymOrI ? trimmed : trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

export function templateLines(text: string): string[] {
  return text.split("\n");
}
