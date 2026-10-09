/** Shared by the server, which sends with it, and the template editor, which previews with it. */

export const PLACEHOLDERS = {
  first_name: "The owner's first name, or \"there\" when we don't know it",
  business: "The business name",
  problem: "The problem on their current site, as the preview builder wrote it",
  link: "The link to their preview",
  price: "59 or 79, from the lead's price arm",
  sender: "Who the email is from",
  address: "The mailing address CAN-SPAM requires",
} as const;

export type Placeholder = keyof typeof PLACEHOLDERS;
export type TemplateValues = Record<Placeholder, string>;

export type OutreachSettings = {
  subject: string;
  firstEmail: string;
  followUp: string;
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
    "I rebuilt your site from your own photos and text so you can see it before deciding anything: {link}",
    "",
    "If you like it, we'll host it and keep it up to date for ${price} a month, with no setup fee. When something changes, like your hours or a price, you just email us and it's usually live the same day.",
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
    "It's ${price} a month to keep it live and current, and you can cancel anytime.",
    "",
    "Warmly,",
    "{sender}",
    "Defect Technologies, {address}",
    "Not interested? Reply \"no thanks\" and we won't email again.",
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
