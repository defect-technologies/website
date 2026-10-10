import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { SENT_FROM_GMAIL } from "@/lib/senders";
import { activity, businesses, messages, previewJobs, type Business } from "../db/schema";
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
      body: `Hi ${business.ownerFirstName || "there"}, ${business.emailProblem}.\nI rebuilt it from your current photos and text: https://defect.tech/p/${business.linkCode}`,
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
  if (!(await hasBuilds(everySample))) {
    await sampleBuilds(allBySlug);
    await sampleActivity(allBySlug);
  }
  return inserted.length;
}
