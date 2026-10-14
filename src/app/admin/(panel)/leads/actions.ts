"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asClause } from "@/lib/emailTemplate";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { STAGES } from "@/server/db/schema";
import { BRAND_FILE_TYPES, MAX_BRAND_FILE_BYTES } from "@/lib/brandFiles";
import { isUploadFor, removeBrandFile, saveBrandFile } from "@/server/leads/brandFiles";
import { businessById, updateBusiness } from "@/server/leads/businesses";
import { importLeads } from "@/server/leads/import";
import { launchBlocker, requestPreview } from "@/server/runner/jobs";
import { closeFlagsOn } from "@/server/bots/flags";

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
  revalidatePath("/admin", "layout");
  revalidatePath("/admin", "layout");
}

/** Queues a launch on the runner. When it finishes, the site is added to Sites so its owner can sign in at /edit. */
export async function launchSiteAction(form: FormData) {
  const founder = await requireFounder();
  const lead = await businessById(String(form.get("id") ?? ""));
  if (!lead || launchBlocker(lead)) return;
  await requestPreview(lead, founder.email, "", "launch");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin", "layout");
}

/** A founder has looked at a preview the design critic held back, and it's fine to send. */
export async function approvePreviewAction(form: FormData) {
  const founder = await requireFounder();
  const lead = await businessById(String(form.get("id") ?? ""));
  if (!lead || lead.stage !== "new" || !lead.previewUrl) return;
  await updateBusiness(lead.id, { stage: "preview_built" });
  await record(founder.email, "approved the preview", { businessId: lead.id });
  await closeFlagsOn(lead.id, ["preview-review"], "A founder marked the preview ready to send.", founder.email);
  revalidatePath("/admin", "layout");
}

const UploadedBrandFile = z.object({
  leadId: z.uuid(),
  url: z.url({ protocol: /^https$/ }),
  name: z.string().trim().min(1).max(200),
  contentType: z.enum(BRAND_FILE_TYPES),
  size: z.number().int().positive().max(MAX_BRAND_FILE_BYTES),
});

/** Records a file the browser just uploaded to Blob, once we've checked it landed in this lead's folder. */
export async function saveBrandFileAction(file: z.input<typeof UploadedBrandFile>): Promise<FormResult> {
  const founder = await requireFounder();
  const parsed = UploadedBrandFile.safeParse(file);
  if (!parsed.success || !isUploadFor(parsed.data.url, parsed.data.leadId)) return { ok: false, message: "That upload didn't come through. Try it again." };
  const { leadId, ...rest } = parsed.data;
  try {
    await saveBrandFile({ businessId: leadId, ...rest }, founder.email);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Couldn't save that file." };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: "" };
}

export async function removeBrandFileAction(leadId: string, form: FormData) {
  const founder = await requireFounder();
  await removeBrandFile(String(form.get("id") ?? ""), leadId, founder.email);
  revalidatePath("/admin", "layout");
}
