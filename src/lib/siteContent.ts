/**
 * The shape of a client site's content.json (core/engine/preview/content.schema.json)
 * and the slice of it an owner may change in the editor.
 */

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABEL: Record<Day, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const SECTIONS = ["services", "about", "gallery", "visit"] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_LABEL: Record<Section, string> = {
  services: "Services",
  about: "About",
  gallery: "Our work",
  visit: "Hours and location",
};

export type Image = { src: string; alt: string };
export type Service = { name: string; description?: string; price?: string };
export type OpenDay = { day: Day; open: string; close: string };

export type SiteContent = {
  business: { name: string; what_we_do: string; category?: string };
  hero: { headline: string; subheadline?: string; image?: Image | null; primary_action?: { label: string; url: string } };
  about?: { heading?: string; paragraphs?: string[] } | null;
  services?: { heading?: string; intro?: string; items?: Service[] } | null;
  gallery?: Image[] | null;
  hours?: OpenDay[] | null;
  hours_note?: string;
  contact: { phone?: string; email?: string; address_lines?: string[]; booking_url?: string; booking_label?: string };
  social?: Partial<Record<"instagram" | "facebook" | "yelp" | "tiktok", string>>;
  logo?: Image | null;
  style: { preset: "classic" | "modern" | "warm"; accent: string };
  outreach: { problem: string; email_opener: string };
  layout?: { section_order?: Section[] };
};

/** Everything the editor can touch. Every other field in content.json stays as it is. */
export type EditableContent = {
  headline: string;
  tagline: string;
  aboutParagraphs: string[];
  services: Required<Service>[];
  hours: OpenDay[];
  hoursNote: string;
  phone: string;
  email: string;
  bookingUrl: string;
  sectionOrder: Section[];
};

/** Limits from content.schema.json where it sets one, and sensible ceilings where it doesn't. */
export const LIMITS = {
  headline: 40,
  tagline: 140,
  aboutParagraph: 600,
  aboutParagraphs: 4,
  serviceName: 60,
  serviceDescription: 160,
  servicePrice: 30,
  services: 24,
  hoursNote: 120,
  phone: 30,
  email: 120,
  bookingUrl: 300,
} as const;

export function sectionOrderOf(content: SiteContent): Section[] {
  const saved = content.layout?.section_order ?? [];
  const known = saved.filter((section) => SECTIONS.includes(section));
  return [...new Set([...known, ...SECTIONS])];
}

export function editableFrom(content: SiteContent): EditableContent {
  return {
    headline: content.hero.headline,
    tagline: content.hero.subheadline ?? "",
    aboutParagraphs: content.about?.paragraphs ?? [],
    services: (content.services?.items ?? []).map((item) => ({ name: item.name, description: item.description ?? "", price: item.price ?? "" })),
    hours: content.hours ?? [],
    hoursNote: content.hours_note ?? "",
    phone: content.contact.phone ?? "",
    email: content.contact.email ?? "",
    bookingUrl: content.contact.booking_url ?? "",
    sectionOrder: sectionOrderOf(content),
  };
}

function withParagraphs(about: SiteContent["about"], paragraphs: string[]): SiteContent["about"] {
  if (!about && paragraphs.length === 0) return about ?? null;
  return { ...(about ?? {}), paragraphs };
}

function withServices(services: SiteContent["services"], items: Service[]): SiteContent["services"] {
  if (!services && items.length === 0) return services ?? null;
  return { ...(services ?? {}), items };
}

const dropEmpty = (service: Required<Service>): Service => ({
  name: service.name,
  ...(service.description ? { description: service.description } : {}),
  ...(service.price ? { price: service.price } : {}),
});

/** Lays an owner's edit over the full content. Fields outside EditableContent can't change here. */
export function applyEditable(content: SiteContent, edit: EditableContent): SiteContent {
  return {
    ...content,
    hero: { ...content.hero, headline: edit.headline, subheadline: edit.tagline },
    about: withParagraphs(content.about, edit.aboutParagraphs),
    services: withServices(content.services, edit.services.map(dropEmpty)),
    hours: edit.hours.length > 0 ? edit.hours : null,
    hours_note: edit.hoursNote,
    contact: { ...content.contact, phone: edit.phone, email: edit.email, booking_url: edit.bookingUrl },
    layout: { ...content.layout, section_order: edit.sectionOrder },
  };
}

/** Names the fields that differ, for the activity log and the version list. */
export function describeChanges(before: EditableContent, after: EditableContent): string[] {
  const labels: Record<keyof EditableContent, string> = {
    headline: "headline",
    tagline: "tagline",
    aboutParagraphs: "about",
    services: "services",
    hours: "hours",
    hoursNote: "hours note",
    phone: "phone",
    email: "email",
    bookingUrl: "booking link",
    sectionOrder: "section order",
  };
  return (Object.keys(labels) as (keyof EditableContent)[])
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => labels[key]);
}
