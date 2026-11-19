"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatCents, todayInPacific } from "@/lib/settleUp";
import { record } from "@/server/activity";
import { isFounder, requireFounder } from "@/server/auth/session";
import { recordPayment } from "@/server/designers/pay";
import { addDesigner, designerById, setDesignerActive } from "@/server/designers/people";
import { releaseUnfinished } from "@/server/designers/work";

export type FormState = { problems: string[]; done?: string };

const refresh = () => revalidatePath("/admin/setup/designers", "layout");

const NewDesigner = z.object({
  name: z.string().trim().min(1, "Add the designer's name.").max(80, "Keep the name under 80 characters."),
  email: z.email("Use the email address of the Google account they sign in with."),
});

/** Adds a designer. They can sign in with Google using that email from then on. */
export async function addDesignerAction(_previous: FormState, form: FormData): Promise<FormState> {
  const founder = await requireFounder();
  const parsed = NewDesigner.safeParse({ name: form.get("name"), email: String(form.get("email") ?? "").trim().toLowerCase() });
  if (!parsed.success) return { problems: parsed.error.issues.map((issue) => issue.message) };
  if (isFounder(parsed.data.email)) return { problems: ["That's a founder's email. A founder signs in as a founder."] };
  if ((await addDesigner(parsed.data.name, parsed.data.email, founder.email)) === "exists") return { problems: [`${parsed.data.email} is already a designer.`] };
  await record(founder.email, "added a designer", { detail: `${parsed.data.name}, ${parsed.data.email}` });
  refresh();
  return { problems: [], done: `${parsed.data.name} can sign in now.` };
}

/**
 * Deactivates a designer, which signs them out and gives their unfinished designs back to the pool, or lets one back
 * in. Designs they finished stay theirs, so a business that signs up later still earns them their share.
 */
export async function setDesignerActiveAction(form: FormData) {
  const founder = await requireFounder();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return;
  const active = form.get("active") === "true";
  const designer = await setDesignerActive(id.data, active, founder.email);
  if (!designer) return refresh();
  const released = active ? 0 : await releaseUnfinished(designer.id);
  const returned = released ? `, ${released} unfinished ${released === 1 ? "design" : "designs"} back to the pool` : "";
  await record(founder.email, active ? "let a designer back in" : "deactivated a designer", { detail: `${designer.name}, ${designer.email}${returned}` });
  refresh();
}

const dollarsToCents = (amount: string) => Math.round(Number(amount.replace(/[$,\s]/g, "")) * 100);

const Payment = z.object({
  designerId: z.uuid(),
  amount: z
    .string()
    .regex(/^\s*\$?\s*[\d,]+(\.\d{1,2})?\s*$/, "Write the amount in dollars, like 59 or 59.00.")
    .transform(dollarsToCents)
    .refine((cents) => cents > 0, "The amount has to be more than $0."),
  paidOn: z.iso.date("Pick the date it was sent.").refine((date) => date <= todayInPacific(), "Pick a date that isn't in the future."),
  note: z.string().trim().max(300, "Keep the note under 300 characters.").default(""),
});

/** Records a Zelle a founder sent a designer. What they're owed goes down by it. */
export async function recordPaymentAction(_previous: FormState, form: FormData): Promise<FormState> {
  const founder = await requireFounder();
  const parsed = Payment.safeParse({ designerId: form.get("designerId"), amount: form.get("amount") ?? "", paidOn: form.get("paidOn"), note: form.get("note") ?? "" });
  if (!parsed.success) return { problems: parsed.error.issues.map((issue) => issue.message) };
  const designer = await designerById(parsed.data.designerId);
  if (!designer) return { problems: ["That designer isn't here any more."] };
  const { amount, paidOn, note } = parsed.data;
  await recordPayment({ designerId: designer.id, amountCents: amount, paidOn, note, recordedBy: founder.email });
  await record(founder.email, "recorded a designer payment", { detail: `${formatCents(amount)} to ${designer.name} on ${paidOn}${note ? `. ${note}` : ""}` });
  refresh();
  return { problems: [], done: `Recorded ${formatCents(amount)} to ${designer.name}.` };
}
