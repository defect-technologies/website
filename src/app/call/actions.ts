"use server";

import { z } from "zod";
import type { CallDay } from "@/lib/callSlots";
import { bookCall } from "@/server/calls/book";

export type CallField = "start" | "name" | "email" | "business" | "note";

export type CallFormState =
  | { state: "idle" }
  | { state: "booked"; email: string; start: number }
  | { state: "invalid"; errors: Partial<Record<CallField, string>> }
  | { state: "taken"; days: CallDay[] }
  | { state: "unavailable" };

const NOTE_LIMIT = 1000;

const CallInput = z.object({
  start: z.coerce.number({ error: "Pick a time for the call." }).int("Pick a time for the call.").positive("Pick a time for the call."),
  name: z.string().trim().min(1, "Enter your name.").max(200),
  email: z.email("Enter an email address like name@example.com.").trim().toLowerCase().max(200),
  business: z.string().trim().max(200).default(""),
  note: z.string().trim().max(NOTE_LIMIT, `Keep it under ${NOTE_LIMIT} characters.`).default(""),
});

function fieldErrors(error: z.ZodError): Partial<Record<CallField, string>> {
  const errors: Partial<Record<CallField, string>> = {};
  for (const issue of error.issues) errors[issue.path[0] as CallField] ??= issue.message;
  return errors;
}

export async function submitCall(_previous: CallFormState, form: FormData): Promise<CallFormState> {
  const parsed = CallInput.safeParse({ ...Object.fromEntries(form), start: form.get("start") ?? "" });
  if (!parsed.success) return { state: "invalid", errors: fieldErrors(parsed.error) };
  // Bots fill the hidden field. They're told it worked, so they don't retry.
  if (form.get("company")) return { state: "booked", email: parsed.data.email, start: parsed.data.start };
  const outcome = await bookCall(parsed.data);
  if (outcome.booked) return { state: "booked", email: parsed.data.email, start: parsed.data.start };
  return outcome.reason === "taken" ? { state: "taken", days: outcome.days } : { state: "unavailable" };
}
