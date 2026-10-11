"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { ABOUT_LIMIT } from "@/lib/inbound";
import { createFormRequest, formIsBusy, hashAddress } from "@/server/inbound/requests";

export type RequestFormState =
  | { state: "idle" }
  | { state: "sent"; email: string }
  | { state: "invalid"; errors: Partial<Record<RequestField, string>> }
  | { state: "busy" };

export type RequestField = "businessName" | "name" | "email" | "website" | "about";

/** People take longer than this to fill in the form; scripts that post it straight away don't. */
const FASTEST_HUMAN_MS = 3000;

/** "sunrisebakery.com" is how people type their address, so the scheme is added for them. */
function withScheme(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const looksLikeWebsite = (value: string) => {
  try {
    return new URL(value).hostname.includes(".");
  } catch {
    return false;
  }
};

const RequestInput = z
  .object({
    businessName: z.string().trim().min(1, "Enter the business's name.").max(200),
    name: z.string().trim().min(1, "Enter your name so we know who to write to.").max(200),
    email: z.email("Enter an email address like name@example.com.").trim().toLowerCase().max(200),
    hasWebsite: z.enum(["yes", "no"]),
    website: z.string().max(500).transform(withScheme).default(""),
    about: z.string().trim().max(ABOUT_LIMIT, `Keep it under ${ABOUT_LIMIT} characters.`).default(""),
  })
  .superRefine((input, context) => {
    if (input.hasWebsite === "yes" && !looksLikeWebsite(input.website)) context.addIssue({ code: "custom", path: ["website"], message: "Enter your website's address, like sunrisebakery.com." });
    if (input.hasWebsite === "no" && input.about.length < 20) context.addIssue({ code: "custom", path: ["about"], message: "Tell us what the business does and how people reach you, so we have something to build from." });
  });

async function clientAddress() {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "unknown";
}

function fieldErrors(error: z.ZodError): Partial<Record<RequestField, string>> {
  const errors: Partial<Record<RequestField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as RequestField;
    errors[field] ??= issue.message;
  }
  return errors;
}

/** Bots fill the hidden field or post faster than anyone types. They're told it went through, so they don't retry. */
function looksAutomated(form: FormData) {
  const elapsed = Number(form.get("elapsed"));
  return Boolean(form.get("company")) || !Number.isFinite(elapsed) || elapsed < FASTEST_HUMAN_MS;
}

export async function submitRequest(_previous: RequestFormState, form: FormData): Promise<RequestFormState> {
  const parsed = RequestInput.safeParse({ ...Object.fromEntries(form), hasWebsite: form.get("hasWebsite") ?? "yes" });
  if (!parsed.success) return { state: "invalid", errors: fieldErrors(parsed.error) };
  const { hasWebsite, ...request } = parsed.data;
  if (looksAutomated(form)) return { state: "sent", email: request.email };
  const ipHash = hashAddress(await clientAddress());
  if (await formIsBusy(ipHash)) return { state: "busy" };
  await createFormRequest({ ...request, website: hasWebsite === "yes" ? request.website : "" }, ipHash);
  return { state: "sent", email: request.email };
}
