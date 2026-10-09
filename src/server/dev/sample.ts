import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { businesses, messages } from "../db/schema";
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
];

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
  return inserted.length;
}
