/** Shared by the server, which sends with it, and the template editor, which previews with it. */

export const PLACEHOLDERS = {
  first_name: "The owner's first name, or \"there\" when we don't know it",
  business: "The business name",
  problem: "The problem on their current site, as the preview builder wrote it",
  link: "The link to their preview",
  price: "Our usual price, 79. Every lead sees it",
  offer: "For a lead on the $59 offer, the sentence offering to lock in $59 a month if they sign up now. Empty at $79",
  sender: "Who the email is from",
  address: "The mailing address CAN-SPAM requires",
} as const;

export type Placeholder = keyof typeof PLACEHOLDERS;

/** Our price. $59 is a limited-time offer some leads get; they keep it for as long as they stay. A $79 lead never hears about it. */
export const REGULAR_MONTHLY_PRICE = 79;

/** Follows the $79 price sentence for a lead on the offer, and is empty for everyone else. */
export function offerSentence(priceArm: number | null): string {
  if (!priceArm || priceArm >= REGULAR_MONTHLY_PRICE) return "";
  return ` We had so much fun redesigning your site that we'd love to give you a limited-time offer: sign up now and you'll lock in $${priceArm} a month instead of $${REGULAR_MONTHLY_PRICE}, for as long as you're with us.`;
}
export type TemplateValues = Record<Placeholder, string>;

export type OutreachSettings = {
  subject: string;
  firstEmail: string;
  followUp: string;
  /** To a business that asked us for a website. Sent from hello@defect.tech as the team, so it has no sender or address. */
  requestSubject: string;
  requestEmail: string;
  senderName: string;
  mailingAddress: string;
  checkoutLinks: { "59": string; "79": string };
  dailyLimit: number;
  followUpAfterDays: number;
};

export const DEFAULT_SETTINGS: OutreachSettings = {
  subject: "A fresh version of {business}'s website",
  firstEmail: [
    "Hi {first_name}, {problem}.",
    "",
    "I redesigned your site using your own photos and text so you can see it before deciding anything: {link}",
    "",
    "If you like it, we'll host it and keep it up to date for ${price} a month, with no setup fee.{offer} When something changes, like your hours or a price, you just email us and it's usually live the same day.",
    "",
    "If that's less than you pay to keep your current site running, it might be worth a look.",
    "",
    "Warmly,",
    "{sender}",
    "Defect Technologies, {address}",
    "Not interested? Reply \"no thanks\" and we won't email again.",
  ].join("\n"),
  followUp: [
    "Hi {first_name}, just wanted to bump this to the top of your inbox in case it got lost :)",
    "",
    "Here's the fresh version of {business}'s site again: {link}",
    "",
    "It's ${price} a month to keep it live and current, and you can cancel anytime.{offer}",
    "",
    "Warmly,",
    "{sender}",
    "Defect Technologies, {address}",
    "Not interested? Reply \"no thanks\" and we won't email again.",
  ].join("\n"),
  requestSubject: "The new website for {business}",
  requestEmail: [
    "Hi {first_name}, thanks for asking us to build a website for {business}. Here it is: {link}",
    "",
    "If you like it, we'll put it live and keep it up to date for ${price} a month, with no setup fee.{offer} When something changes, like your hours or a price, you just email us and it's usually live the same day.",
    "",
    "Warmly,",
    "The Defect Technologies team",
    "hello@defect.tech",
  ].join("\n"),
  senderName: "Brendan Giang",
  mailingAddress: "",
  checkoutLinks: { "59": "", "79": "" },
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
