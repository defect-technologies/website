"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asClause } from "@/lib/emailTemplate";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { STAGES } from "@/server/db/schema";
import { businessById, updateBusiness } from "@/server/leads/businesses";
import { importLeads } from "@/server/leads/import";
import { launchBlocker, requestPreview } from "@/server/runner/jobs";

export type FormResult = { ok: boolean; message: string };

const MAX_CSV_BYTES = 5 * 1024 * 1024;

export async function importAction(_previous: FormResult, form: FormData): Promise<FormResult> {
  const founder = await requireFounder();
  const file = form.get("csv");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose the leads.csv the lead finder wrote." };
  if (file.size > MAX_CSV_BYTES) return { ok: false, message: "That file is over 5 MB. Is it the right one?" };
  const { added, skipped } = await importLeads(await file.text());
  await record(founder.email, "imported leads", { detail: `${added} added, ${skipped} already here` });
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Added ${added}. Skipped ${skipped} already in the pipeline.` };
}

const optionalUrl = z.union([z.literal(""), z.url({ protocol: /^https?$/ })]);

const LeadEdit = z.object({
  businessName: z.string().trim().min(1).max(200),
  ownerFirstName: z.string().trim().max(60),
  email: z.union([z.literal(""), z.email()]),
  priceArm: z.enum(["", "59", "79"]).transform((value) => (value ? Number(value) : null)),
  stage: z.enum(STAGES),
  emailProblem: z.string().trim().max(300),
  previewUrl: optionalUrl,
  ownerEmail: z.union([z.literal(""), z.email()]),
  siteUrl: optionalUrl,
  vercelProjectId: z.string().trim().max(100),
  note: z.string().max(4000),
});

export async function saveLeadAction(id: string, _previous: FormResult, form: FormData): Promise<FormResult> {
  const founder = await requireFounder();
  const business = await businessById(id);
  if (!business) return { ok: false, message: "That business no longer exists." };
  const parsed = LeadEdit.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: z.prettifyError(parsed.error) };
  const fields = { ...parsed.data, emailProblem: parsed.data.emailProblem ? asClause(parsed.data.emailProblem) : "" };
  const launched = fields.stage === "live" && !business.launchedAt ? { launchedAt: new Date() } : {};
  await updateBusiness(id, { ...fields, ...launched });
  await record(founder.email, "edited lead", { businessId: id });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Saved." };
}

/** Queues a build on the preview runner, optionally with a founder's note for a rebuild. */
export async function requestPreviewAction(form: FormData) {
  const founder = await requireFounder();
  const lead = await businessById(String(form.get("id") ?? ""));
  if (!lead) return;
  const note = String(form.get("note") ?? "").trim().slice(0, 2000);
  await requestPreview(lead, founder.email, note);
  revalidatePath(`/admin/pipeline/${lead.id}`);
  revalidatePath("/admin/projects");
}

/** Queues a launch on the runner. When it finishes, the site is added to Sites so its owner can sign in at /edit. */
export async function launchSiteAction(form: FormData) {
  const founder = await requireFounder();
  const lead = await businessById(String(form.get("id") ?? ""));
  if (!lead || launchBlocker(lead)) return;
  await requestPreview(lead, founder.email, "", "launch");
  revalidatePath(`/admin/pipeline/${lead.id}`);
  revalidatePath("/admin/sites");
}
