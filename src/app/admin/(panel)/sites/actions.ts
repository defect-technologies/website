"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkSiteContent } from "@/lib/siteContentRules";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { businessById } from "@/server/leads/businesses";
import { createSite } from "@/server/sites/databaseStore";
import { rollBackSite } from "@/server/sites/editing";

export async function rollBackAction(form: FormData) {
  const founder = await requireFounder();
  const slug = String(form.get("slug") ?? "");
  const version = Number(form.get("version"));
  const outcome = await rollBackSite(founder, slug, version);
  revalidatePath("/admin/sites", "layout");
  revalidatePath(`/edit/${slug}`, "layout");
  redirect(`/admin/sites/${encodeURIComponent(slug)}?${outcome.ok ? `rolledBack=${version}` : "rollBack=failed"}`);
}

export type AddSiteValues = { slug: string; ownerEmail: string; liveUrl: string; businessId: string; content: string };
export type AddSiteResult = { problems: string[]; values: AddSiteValues };

const RESERVED_SLUGS = new Set(["new"]);

const NewSite = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "The site address can use lowercase letters, numbers and single hyphens, like sunrise-florist.")
    .max(60, "The site address can be up to 60 characters.")
    .refine((slug) => !RESERVED_SLUGS.has(slug), "That site address is reserved. Pick another."),
  ownerEmail: z.email("The owner's email doesn't look right."),
  liveUrl: z.union([z.literal(""), z.url({ protocol: /^https$/, error: "The live address has to start with https://." })]),
  businessId: z.union([z.literal(""), z.uuid()]),
  content: z.string().trim().min(1, "Paste the site's content.json."),
});

function submittedValues(form: FormData): AddSiteValues {
  const field = (name: keyof AddSiteValues) => String(form.get(name) ?? "");
  return { slug: field("slug"), ownerEmail: field("ownerEmail"), liveUrl: field("liveUrl"), businessId: field("businessId"), content: field("content") };
}

export async function addSiteAction(_previous: AddSiteResult, form: FormData): Promise<AddSiteResult> {
  const founder = await requireFounder();
  const values = submittedValues(form);
  const parsed = NewSite.safeParse(values);
  if (!parsed.success) return { problems: parsed.error.issues.map((issue) => issue.message), values };
  const checked = checkSiteContent(parsed.data.content);
  if (!checked.ok) return { problems: checked.problems, values };
  const business = parsed.data.businessId ? await businessById(parsed.data.businessId) : null;

  const { slug, ownerEmail, liveUrl } = parsed.data;
  const site = await createSite({ slug, ownerEmail, content: checked.content, businessId: business?.id ?? null, liveUrl, assetBaseUrl: liveUrl, createdBy: founder.email });
  if (!site) return { problems: [`There's already a site at ${slug}. Pick another address.`], values };

  await record(founder.email, "added a site", { businessId: site.businessId, detail: `${site.businessName}, owned by ${site.ownerEmail}` });
  revalidatePath("/admin/sites", "layout");
  redirect(`/admin/sites/${encodeURIComponent(slug)}?added=1`);
}
