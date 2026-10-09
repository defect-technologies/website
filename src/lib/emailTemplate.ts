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
  subject: "{business}'s website",
  firstEmail: [
    "Hi {first_name}, {problem}.",
    "I rebuilt it from your current photos and text: {link}",
    "If you like it, it goes live for ${price} a month. After that, you just email us when something changes.",
    "{sender}, Defect Technologies, {address}. Reply \"no thanks\" and we won't email again.",
  ].join("\n"),
  followUp: [
    "Hi {first_name}, just wanted to bump this to the top of your inbox in case it got lost :)",
    "Here's the fresh version of your site again: {link}",
    "{sender}, Defect Technologies, {address}. Reply \"no thanks\" and we won't email again.",
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
