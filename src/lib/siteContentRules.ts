import { z } from "zod";
import { DAYS, LIMITS, SECTIONS, editableFrom, type EditableContent, type SiteContent } from "./siteContent";

const MARKUP = /[<>]|\{\{|\{%/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE = /^[0-9+().\-\s]*(\s*(ext\.?|x)\s*\d{1,6})?$/i;

/** One line of plain words: no tags, template syntax, or line breaks. */
function plainText(label: string, max: number, { required = false } = {}) {
  const base = z
    .string()
    .trim()
    .max(max, `${label} can be up to ${max} characters.`)
    .refine((value) => !MARKUP.test(value), `${label} can only be plain text, without < > or {{ }}.`)
    .refine((value) => !CONTROL_CHARACTERS.test(value), `${label} has to fit on one line.`);
  return required ? base.refine((value) => value.length > 0, `${label} can't be empty.`) : base;
}

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

const OpenDay = z
  .object({
    day: z.enum(DAYS),
    open: z.string().regex(TIME, "Opening times look like 09:00."),
    close: z.string().regex(TIME, "Closing times look like 17:30."),
  })
  .strict()
  .refine((day) => minutes(day.open) < minutes(day.close), { message: "Each day has to close after it opens." });

const Service = z
  .object({
    name: plainText("A service name", LIMITS.serviceName, { required: true }),
    description: plainText("A service description", LIMITS.serviceDescription),
    price: plainText("A price", LIMITS.servicePrice),
  })
  .strict();

const bookingUrl = z.union([
  z.literal(""),
  z.url({ protocol: /^https$/, error: "The booking link has to be a full https:// web address." }).max(LIMITS.bookingUrl),
]);

const email = z.union([z.literal(""), z.email("That email address doesn't look right.").max(LIMITS.email)]);

const phone = z
  .string()
  .trim()
  .max(LIMITS.phone)
  .regex(PHONE, "Phone numbers can use digits, spaces, + ( ) - and an extension.");

const sectionOrder = z
  .array(z.enum(SECTIONS))
  .length(SECTIONS.length)
  .refine((order) => new Set(order).size === SECTIONS.length, "Each section can appear once.");

/** Server-side gate for every save. Unknown keys fail, so only the editable fields can ever change. */
export const EditableContentRules = z
  .object({
    headline: plainText("The headline", LIMITS.headline, { required: true }),
    tagline: plainText("The tagline", LIMITS.tagline),
    aboutParagraphs: z.array(plainText("An about paragraph", LIMITS.aboutParagraph, { required: true })).max(LIMITS.aboutParagraphs),
    services: z.array(Service).max(LIMITS.services, `The site can list up to ${LIMITS.services} services.`),
    hours: z
      .array(OpenDay)
      .max(DAYS.length)
      .refine((days) => new Set(days.map((d) => d.day)).size === days.length, "Each day can appear once."),
    hoursNote: plainText("The hours note", LIMITS.hoursNote),
    phone,
    email,
    bookingUrl,
    sectionOrder,
  })
  .strict() satisfies z.ZodType<EditableContent>;

export type EditCheck = { ok: true; content: EditableContent } | { ok: false; problems: string[] };

export function checkEdit(input: unknown): EditCheck {
  const parsed = EditableContentRules.safeParse(input);
  if (parsed.success) return { ok: true, content: { ...parsed.data, hours: sortByWeekday(parsed.data.hours) } };
  return { ok: false, problems: [...new Set(parsed.error.issues.map((issue) => issue.message))] };
}

function sortByWeekday(hours: EditableContent["hours"]) {
  return [...hours].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
}

const ImageShape = z.looseObject({ src: z.string(), alt: z.string() });

/** The parts of content.json the renderer and editor rely on. Extra keys from the preview builder pass through. */
const SiteContentShape = z.looseObject({
  business: z.looseObject({ name: z.string().trim().min(1, "business.name is missing."), what_we_do: z.string() }),
  hero: z.looseObject({ headline: z.string(), subheadline: z.string().optional(), image: ImageShape.nullish() }),
  about: z.looseObject({ paragraphs: z.array(z.string()).optional() }).nullish(),
  services: z.looseObject({ items: z.array(z.looseObject({ name: z.string() })).optional() }).nullish(),
  gallery: z.array(ImageShape).nullish(),
  hours: z.array(z.looseObject({ day: z.string(), open: z.string(), close: z.string() })).nullish(),
  contact: z.looseObject({}),
  style: z.looseObject({ preset: z.enum(["classic", "modern", "warm"]), accent: z.string() }),
  outreach: z.looseObject({}),
});

export type SiteContentCheck = { ok: true; content: SiteContent } | { ok: false; problems: string[] };

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function describeShapeIssue(issue: z.core.$ZodIssue): string {
  const field = issue.path.join(".") || "content.json";
  if (issue.code === "invalid_type" && issue.input === undefined) return `content.json is missing ${field}.`;
  if (issue.code === "invalid_type") return `${field} should be ${issue.expected === "object" ? "a group of fields in { }" : `a ${issue.expected}`}.`;
  if (issue.code === "invalid_value") return `${field} has to be one of: ${issue.values.join(", ")}.`;
  return `${field}: ${issue.message}`;
}

/** For a site added by hand: the JSON parses, has the shape the renderer needs, and opens cleanly in the editor. */
export function checkSiteContent(text: string): SiteContentCheck {
  const json = parseJson(text);
  if (json === undefined) return { ok: false, problems: ["That isn't valid JSON. Paste the whole content.json the preview builder wrote."] };
  const shaped = SiteContentShape.safeParse(json, { reportInput: true });
  if (!shaped.success) return { ok: false, problems: shaped.error.issues.map(describeShapeIssue) };
  const content = shaped.data as unknown as SiteContent;
  const editable = checkEdit(editableFrom(content));
  if (!editable.ok) return { ok: false, problems: editable.problems };
  return { ok: true, content };
}
