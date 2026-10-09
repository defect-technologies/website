"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { emailSignInLink, linksReady } from "@/server/editor/signInLinks";
import { businessById } from "@/server/leads/businesses";
import { addClientSite, changeSiteOwner, clientSite } from "@/server/sites/clientSites";

export type AddSiteValues = { slug: string; ownerEmail: string; url: string; businessId: string };
export type AddSiteResult = { problems: string[]; values: AddSiteValues };

const RESERVED_SLUGS = new Set(["new"]);

const ownerEmail = z.email("The owner's email doesn't look right.");

const NewSite = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "The slug can use lowercase letters, numbers and single hyphens, like sunrise-florist.")
    .max(60, "The slug can be up to 60 characters.")
    .refine((slug) => !RESERVED_SLUGS.has(slug), "That slug is reserved. Pick another."),
  ownerEmail,
  url: z.url({ protocol: /^https$/, error: "The site's address has to start with https://." }),
  businessId: z.union([z.literal(""), z.uuid()]),
});

function submittedValues(form: FormData): AddSiteValues {
  const field = (name: keyof AddSiteValues) => String(form.get(name) ?? "");
  return { slug: field("slug"), ownerEmail: field("ownerEmail"), url: field("url"), businessId: field("businessId") };
}

export async function addSiteAction(_previous: AddSiteResult, form: FormData): Promise<AddSiteResult> {
  const founder = await requireFounder();
  const values = submittedValues(form);
  const parsed = NewSite.safeParse(values);
  if (!parsed.success) return { problems: parsed.error.issues.map((issue) => issue.message), values };
  const business = parsed.data.businessId ? await businessById(parsed.data.businessId) : null;

  const { slug, url } = parsed.data;
  const site = await addClientSite({ slug, ownerEmail: parsed.data.ownerEmail, url, businessId: business?.id ?? null, createdBy: founder.email });
  if (!site) return { problems: [`There's already a site called ${slug}. Pick another slug.`], values };

  await record(founder.email, "added a site", { businessId: site.businessId, detail: `${site.url}, owned by ${site.ownerEmail}` });
  revalidatePath("/admin/sites", "layout");
  redirect(`/admin/sites/${encodeURIComponent(slug)}?added=1`);
}

const sitePage = (slug: string, query: string) => `/admin/sites/${encodeURIComponent(slug)}?${query}`;

export async function sendLinkAction(form: FormData) {
  const founder = await requireFounder();
  const site = await clientSite(String(form.get("slug") ?? ""));
  if (!site) redirect("/admin/sites");
  if (!linksReady()) redirect(sitePage(site.slug, "link=not-ready"));
  try {
    await emailSignInLink(site);
  } catch (error) {
    console.error(`[editor] Sign-in email for ${site.slug} failed to send`, error);
    redirect(sitePage(site.slug, "link=failed"));
  }
  await record(founder.email, "emailed a sign-in link", { businessId: site.businessId, detail: `${site.url} to ${site.ownerEmail}` });
  redirect(sitePage(site.slug, "link=sent"));
}

export async function changeOwnerAction(form: FormData) {
  const founder = await requireFounder();
  const slug = String(form.get("slug") ?? "");
  const parsed = ownerEmail.safeParse(String(form.get("ownerEmail") ?? "").trim());
  if (!parsed.success) redirect(sitePage(slug, "owner=invalid"));
  const site = await changeSiteOwner(slug, parsed.data);
  if (!site) redirect("/admin/sites");
  await record(founder.email, "changed a site's owner", { businessId: site.businessId, detail: `${site.url} is now owned by ${site.ownerEmail}` });
  revalidatePath("/admin/sites", "layout");
  redirect(sitePage(slug, "owner=changed"));
}
