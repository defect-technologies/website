import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { SENT_FROM_GMAIL } from "@/lib/senders";
import { activity, businesses, inboundRequests, messages, previewJobs, spotChecks, type Business } from "../db/schema";
import { upsertProspects, type ProspectInput } from "../prospects";
import { newLinkCode } from "../leads/import";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

type Sample = Partial<typeof businesses.$inferInsert> & { businessName: string; slug: string };

/** Made-up businesses on example.com, for trying the admin locally. None of them exist. */
const SAMPLES: Sample[] = [
  { businessName: "Arroyo Plumbing", slug: "arroyo-plumbing", niche: "plumber", priceArm: 59, stage: "preview_built", ownerFirstName: "Dana", emailProblem: "your site still says © 2019 and gets cut off on phones", previewBuiltAt: daysAgo(1), outdatedScore: 7 },
  { businessName: "Pine Hill HVAC", slug: "pine-hill-hvac", niche: "HVAC", priceArm: 79, stage: "preview_built", emailProblem: "the booking button on your site leads to a page that no longer exists", previewBuiltAt: daysAgo(1), outdatedScore: 5 },
  { businessName: "Fern & Co Dog Grooming", slug: "fern-co-dog-grooming", niche: "dog groomer", priceArm: 59, stage: "preview_built", ownerFirstName: "Priya", emailProblem: "your homepage still shows a COVID hours notice from 2020", previewBuiltAt: daysAgo(0), outdatedScore: 6 },
  { businessName: "Linden Tattoo", slug: "linden-tattoo", niche: "tattoo studio", priceArm: 79, stage: "sent", ownerFirstName: "Marco", emailProblem: "your site doesn't load over HTTPS, so browsers warn visitors away", previewBuiltAt: daysAgo(7), firstSentAt: daysAgo(5), outdatedScore: 5 },
  { businessName: "Altadena Roofing", slug: "altadena-roofing", niche: "roofer", priceArm: 59, stage: "replied", ownerFirstName: "Sam", emailProblem: "your site still says © 2018", previewBuiltAt: daysAgo(9), firstSentAt: daysAgo(6), clickedAt: daysAgo(5), clickCount: 3, repliedAt: daysAgo(1), outdatedScore: 4 },
  { businessName: "Sunset Mobile Detailing", slug: "sunset-mobile-detailing", niche: "mobile detailing", priceArm: 79, stage: "paid", ownerFirstName: "Lee", emailProblem: "your site has no mobile layout", previewBuiltAt: daysAgo(12), firstSentAt: daysAgo(10), clickedAt: daysAgo(9), repliedAt: daysAgo(8), paidAt: daysAgo(6), plan: "$79/month", outdatedScore: 8 },
  { businessName: "Marigold Bakery", slug: "marigold-bakery", niche: "bakery", stage: "new", outdatedScore: 6, problemSummary: "Copyright year 2017; no mobile layout" },
  { businessName: "Eastside Electric", slug: "eastside-electric", niche: "electrician", stage: "new", outdatedScore: 3, problemSummary: "Copyright year 2021" },
  { businessName: "Juniper Yoga", slug: "juniper-yoga", niche: "yoga studio", stage: "new", outdatedScore: 5, problemSummary: "Class schedule is a 2019 PDF" },
  { businessName: "Cedar Barbers", slug: "cedar-barbers", niche: "barber", priceArm: 59, stage: "live", ownerFirstName: "Ray", previewBuiltAt: daysAgo(30), firstSentAt: daysAgo(28), paidAt: daysAgo(20), launchedAt: daysAgo(14), plan: "$59/month", siteUrl: "https://cedar-barbers.example.com", outdatedScore: 6 },
];

const MINUTE = 60 * 1000;
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * MINUTE);

/** A reply the Outreach bot sent from Gmail itself, which the mail sync picks up from Sent. */
async function sampleGmailReply(roofing: Business | undefined) {
  if (!roofing) return;
  await (await db())
    .insert(messages)
    .values({
      businessId: roofing.id, direction: "out", kind: "reply", threadId: `sample-thread-${roofing.slug}`, gmailId: "sample-gmail-roofing",
      fromAddress: "brendan@sending.example.com", toAddress: roofing.email, subject: "Re: Altadena Roofing's website",
      body: "Happy to add the crew photo. Your domain stays yours; we only point it at the new site.", sentBy: SENT_FROM_GMAIL, at: minutesAgo(40),
    })
    .onConflictDoNothing();
}

/** Builds and bot activity are seeded once, the first time samples load, so loading again adds no duplicates. */
async function hasBuilds(samples: Business[]) {
  if (samples.length === 0) return false;
  const [job] = await (await db()).select({ id: previewJobs.id }).from(previewJobs).where(inArray(previewJobs.businessId, samples.map((b) => b.id))).limit(1);
  return Boolean(job);
}

/** One build of each kind, so the Overview shows a running, a queued and a failed build. */
async function sampleBuilds(bySlug: Map<string, Business>) {
  const jobs = [
    { slug: "marigold-bakery", status: "running" as const, requestedBy: "bot:outreach", step: "Writing the home page from the old site's photos", runnerName: "runner-1", claimedAt: minutesAgo(9), startedAt: minutesAgo(8) },
    { slug: "eastside-electric", status: "queued" as const, requestedBy: "bot:outreach" },
    { slug: "juniper-yoga", status: "failed" as const, requestedBy: "sample@dev.localhost", criticVerdict: "The old site blocks scraping, so there were no photos to use", finishedAt: daysAgo(1) },
  ];
  for (const { slug, ...job } of jobs) {
    const business = bySlug.get(slug);
    if (business) await (await db()).insert(previewJobs).values({ businessId: business.id, ...job }).onConflictDoNothing();
  }
}

/** What the bots did lately, as the activity log would record it. */
async function sampleActivity(bySlug: Map<string, Business>) {
  const entries = [
    { actor: "bot:outreach", slug: "altadena-roofing", action: "replied from Gmail", detail: "Answered the crew photo and domain questions", at: minutesAgo(40) },
    { actor: "bot:runner", slug: "marigold-bakery", action: "claimed a preview build", detail: "runner-1, attempt 1", at: minutesAgo(9) },
    { actor: "bot:onboarding", slug: "sunset-mobile-detailing", action: "note", detail: "Waiting on Lee for the domain registrar login", at: daysAgo(1) },
    { actor: "bot:client_care", slug: "cedar-barbers", action: "note", detail: "Updated holiday hours on the home page", at: daysAgo(2) },
  ];
  for (const { slug, ...entry } of entries) {
    const business = bySlug.get(slug);
    if (business) await (await db()).insert(activity).values({ businessId: business.id, ...entry });
  }
}

/** Two previews waiting for a spot check and three already rated. Preview links are unique, so loading again adds none. */
async function sampleSpotChecks(bySlug: Map<string, Business>) {
  const checks = [
    { slug: "fern-co-dog-grooming", sampledAt: minutesAgo(30) },
    { slug: "pine-hill-hvac", sampledAt: daysAgo(1) },
    { slug: "linden-tattoo", sampledAt: daysAgo(7), status: "done" as const, copyRating: 4, typographyRating: 2, layoutRating: 3, note: "Headings use three different weights. The hero headline wraps to four lines on a phone.", reviewedBy: "boris.nezlobin@gmail.com", reviewedAt: daysAgo(6) },
    { slug: "altadena-roofing", sampledAt: daysAgo(9), status: "done" as const, copyRating: 3, typographyRating: 4, layoutRating: 4, note: "Copy reads like a template: \"quality you can trust\". Use the owner's own words from the old About page.", reviewedBy: "brendan@g.studio", reviewedAt: daysAgo(8) },
    { slug: "cedar-barbers", sampledAt: daysAgo(30), status: "done" as const, copyRating: 5, typographyRating: 5, layoutRating: 4, note: "", reviewedBy: "brendan@g.studio", reviewedAt: daysAgo(29) },
  ];
  for (const { slug, ...check } of checks) {
    const business = bySlug.get(slug);
    if (business) await (await db()).insert(spotChecks).values({ businessId: business.id, previewUrl: `https://example.com/?preview=${slug}`, ...check }).onConflictDoNothing();
  }
}

const prospect = (name: string, fields: Partial<ProspectInput>): ProspectInput => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    place_id: "", business_name: name, website: `https://${slug}.example.com`, niche: "plumber", area: "Pasadena, CA", platform: "WordPress", email: "", emails: [], instagram: "", phone: "",
    address: "", social_links: {}, review_links: [], booking_links: [], ordering_links: [], page_title: name, meta_description: "", copyright_year: null, reachable: true,
    site_score: 70, outdated_score: 30, signals: [], problem_summary: "", lead_type: "outdated-no-email", page_count: 6, server_ms: 640, load_ms: 4200, page_bytes: 2_400_000, audit: {}, ...fields,
  };
};

/** Businesses the lead finder looked at, most of which never became leads. All on example.com. */
async function sampleProspects() {
  await upsertProspects([
    prospect("Arroyo Plumbing", { email: "hello@arroyo-plumbing.example.com", emails: ["hello@arroyo-plumbing.example.com"], site_score: 35, outdated_score: 65, signals: ["copyright_4plus_years", "cut_off_on_phone", "no_https"], problem_summary: "the footer still says © 2019; on a phone part of the page is cut off; browsers mark it as \"Not secure\"", lead_type: "email-ready", phone: "(626) 555-0142", copyright_year: 2019, audit: { signal_details: [{ name: "copyright_4plus_years", points: 20, plain: "the footer still says © 2019", detail: "© 2019 in the footer" }, { name: "cut_off_on_phone", points: 15, plain: "on a phone part of the page is cut off", detail: "4 elements run past the right edge" }, { name: "no_https", points: 20, plain: "browsers mark it as \"Not secure\"" }] } }),
    prospect("Rose Bowl Rooter", { site_score: 62, signals: ["no_mobile_layout", "old_jquery"], problem_summary: "the site doesn't adjust for phones; it runs on very old code", phone: "(626) 555-0199", address: "1200 E Colorado Blvd, Pasadena, CA 91106", platform: "Custom or unknown", review_links: ["https://www.yelp.com/biz/rose-bowl-rooter-example"] }),
    prospect("Lake Ave Drain Co", { site_score: 92, outdated_score: 8, signals: ["no_meta_description", "no_share_preview"], lead_type: "current", email: "office@lake-ave-drain-co.example.com", emails: ["office@lake-ave-drain-co.example.com"], platform: "Squarespace" }),
    prospect("Pasadena Heat & Air", { niche: "HVAC", site_score: 48, outdated_score: 52, signals: ["copyright_4plus_years", "broken_booking_link", "small_tap_targets"], email: "service@pasadena-heat-air.example.com", emails: ["service@pasadena-heat-air.example.com", "jobs@pasadena-heat-air.example.com"], booking_links: ["https://pasadena-heat-air.example.com/book"], lead_type: "email-ready", instagram: "pasadenaheat", social_links: { facebook: "https://facebook.com/pasadenaheatexample", instagram: "https://instagram.com/pasadenaheat" } }),
    prospect("Glendale Comfort Systems", { niche: "HVAC", area: "Glendale, CA", site_score: 81, outdated_score: 19, signals: ["slow_server", "no_favicon", "copyright_2to3_years"], platform: "Wix", lead_type: "current" }),
    prospect("Brand Blvd Tattoo", { niche: "tattoo studio", area: "Glendale, CA", site_score: 20, outdated_score: 80, signals: ["builder_ads", "no_mobile_layout", "flash", "copyright_4plus_years"], platform: "Weebly", instagram: "brandblvdink", lead_type: "outdated-no-email" }),
    prospect("Colorado St Bakery", { niche: "bakery", site_score: 55, outdated_score: 45, signals: ["covid_notice", "tiny_text_on_phone", "no_images"], ordering_links: ["https://www.doordash.com/store/colorado-st-bakery-example"], email: "orders@colorado-st-bakery.example.com", emails: ["orders@colorado-st-bakery.example.com"], lead_type: "email-ready", platform: "GoDaddy" }),
    prospect("Echo Park Plumbing", { business_name: "", area: "Los Angeles, CA", website: "", site_score: null, outdated_score: 0, reachable: false, lead_type: "no-site", place_id: "sample-place-echo-park", platform: "", page_count: null, server_ms: null, load_ms: null, page_bytes: null }),
  ]);
}

/** What the form and hello@ bring in: one request with a website, one without, and emails for Client care to sort. All made up. */
async function sampleInbound() {
  const database = await db();
  await database
    .insert(inboundRequests)
    .values([
      { source: "email", kind: "unsorted", email: "owner@mesa-auto.example.com", subject: "Website?", body: "Hi, a friend said you redesigned her bakery's site. Our shop's site is mesa-auto.example.com and it's a mess. Can you do ours?", gmailId: "sample-inbound-1", threadId: "sample-inbound-thread-1", at: minutesAgo(15) },
      { source: "email", kind: "unsorted", email: "kim@harbor-dental.example.com", subject: "Price question", body: "Is the $59 a month for one location or both of ours?", gmailId: "sample-inbound-4", threadId: "sample-inbound-thread-4", at: minutesAgo(25) },
      { source: "email", kind: "founder", email: "reporter@local-news.example.com", subject: "Interview request", body: "I'm writing about small businesses and AI. Could one of the founders talk this week?", reason: "A press request; a founder should decide.", sortedBy: "bot:client_care", gmailId: "sample-inbound-2", at: daysAgo(1) },
      { source: "email", kind: "ignore", status: "closed", email: "deals@seo-blast.example.com", subject: "Rank #1 on Google GUARANTEED", body: "Get to page one in 30 days.", reason: "SEO spam.", sortedBy: "bot:client_care", gmailId: "sample-inbound-3", at: daysAgo(2) },
    ])
    .onConflictDoNothing();
  const forms = await database.select({ email: inboundRequests.email }).from(inboundRequests).where(eq(inboundRequests.source, "form"));
  const has = new Set(forms.map((row) => row.email));
  const formSamples = [
    { source: "form" as const, kind: "request" as const, name: "Rosa Diaz", email: "rosa@tamale-cart.example.com", businessName: "Rosa's Tamales", about: "We sell tamales from a cart on Figueroa St near USC, Tuesday to Saturday 7am to 1pm. Pork, chicken and rajas con queso. Call or text (213) 555-0187 for catering orders.", at: minutesAgo(40) },
    { source: "form" as const, kind: "request" as const, name: "Glen Park", email: "glen@park-piano.example.com", businessName: "Park Piano Studio", website: "https://park-piano.example.com", about: "Our site still lists 2019 recital dates.", at: minutesAgo(180) },
  ].filter((sample) => !has.has(sample.email));
  if (formSamples.length > 0) await database.insert(inboundRequests).values(formSamples);
}

function toRow(sample: Sample): typeof businesses.$inferInsert {
  return {
    linkCode: newLinkCode(),
    website: `https://${sample.slug}.example.com`,
    email: `hello@${sample.slug}.example.com`,
    area: "Pasadena, CA",
    leadType: "email-ready",
    previewUrl: sample.previewBuiltAt ? "https://example.com/" : "",
    ...sample,
  };
}

export async function loadSamples() {
  const database = await db();
  const inserted = await database.insert(businesses).values(SAMPLES.map(toRow)).onConflictDoNothing().returning();
  const bySlug = new Map(inserted.map((b) => [b.slug, b]));
  const thread = (slug: string) => `sample-thread-${slug}`;
  const sent = inserted.filter((b) => b.firstSentAt);
  for (const business of sent) {
    await database.insert(messages).values({
      businessId: business.id, direction: "out", kind: "first", threadId: thread(business.slug), gmailId: `sample-out-${business.slug}`,
      fromAddress: "brendan@sending.example.com", toAddress: business.email, subject: `${business.businessName}'s website`,
      body: `Hi ${business.ownerFirstName || "there"}, ${business.emailProblem}.\nI redesigned it using your current photos and text: https://defect.tech/p/${business.linkCode}`,
      sentBy: "sample", at: business.firstSentAt ?? new Date(),
    });
    await database.update(businesses).set({ threadId: thread(business.slug) }).where(eq(businesses.id, business.id));
  }
  const roofing = bySlug.get("altadena-roofing");
  if (roofing) {
    await database.insert(messages).values({
      businessId: roofing.id, direction: "in", kind: "inbound", threadId: thread(roofing.slug), gmailId: "sample-in-roofing",
      fromAddress: roofing.email, toAddress: "brendan@sending.example.com", subject: "Re: Altadena Roofing's website",
      body: "This looks great. Can you add our new crew photo before it goes live? And what happens to our domain?", at: daysAgo(1),
    });
  }
  const everySample = await database.select().from(businesses).where(inArray(businesses.slug, SAMPLES.map((sample) => sample.slug)));
  const allBySlug = new Map(everySample.map((b) => [b.slug, b]));
  await sampleGmailReply(allBySlug.get("altadena-roofing"));
  await sampleSpotChecks(allBySlug);
  await sampleProspects();
  await sampleInbound();
  if (!(await hasBuilds(everySample))) {
    await sampleBuilds(allBySlug);
    await sampleActivity(allBySlug);
  }
  return inserted.length;
}
