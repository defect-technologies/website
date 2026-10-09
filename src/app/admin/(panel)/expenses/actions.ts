"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatCents, founderName, monthName } from "@/lib/settleUp";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { env } from "@/server/env";
import { addExpense, deleteExpense, settleMonth } from "@/server/expenses/expenses";

export type ExpenseValues = { spentOn: string; item: string; amount: string; paidBy: string };
export type AddExpenseResult = { problems: string[]; values: ExpenseValues; addedId?: string };

const dollarsToCents = (amount: string) => Math.round(Number(amount.replace(/[$,\s]/g, "")) * 100);

const NewExpense = z.object({
  spentOn: z.iso.date("Pick the date it was paid."),
  item: z.string().trim().min(1, "Say what the expense was for.").max(200, "Keep what it was for under 200 characters."),
  amount: z
    .string()
    .regex(/^\s*\$?\s*[\d,]+(\.\d{1,2})?\s*$/, "The amount should be in dollars, like 20 or 8.40.")
    .transform(dollarsToCents)
    .refine((cents) => cents > 0, "The amount has to be more than $0."),
  paidBy: z.string().refine((email) => env.founderEmails().includes(email), "Pick which founder paid."),
});

function submittedValues(form: FormData): ExpenseValues {
  const field = (name: keyof ExpenseValues) => String(form.get(name) ?? "");
  return { spentOn: field("spentOn"), item: field("item"), amount: field("amount"), paidBy: field("paidBy") };
}

export async function addExpenseAction(_previous: AddExpenseResult, form: FormData): Promise<AddExpenseResult> {
  const founder = await requireFounder();
  const values = submittedValues(form);
  const parsed = NewExpense.safeParse(values);
  if (!parsed.success) return { problems: parsed.error.issues.map((issue) => issue.message), values };

  const { spentOn, item, amount, paidBy } = parsed.data;
  const expense = await addExpense({ spentOn, item, amountCents: amount, paidBy, createdBy: founder.email });
  await record(founder.email, "added an expense", { detail: `${item}, ${formatCents(amount)}, paid by ${founderName(paidBy)} on ${spentOn}` });
  revalidatePath("/admin/expenses");
  return { problems: [], values: { spentOn, item: "", amount: "", paidBy }, addedId: expense.id };
}

export async function deleteExpenseAction(form: FormData) {
  const founder = await requireFounder();
  const removed = await deleteExpense(String(form.get("id") ?? ""));
  if (!removed) return;
  await record(founder.email, "deleted an expense", { detail: `${removed.item}, ${formatCents(removed.amountCents)}, from ${removed.spentOn}` });
  revalidatePath("/admin/expenses");
}

export async function settleMonthAction(form: FormData) {
  const founder = await requireFounder();
  const month = String(form.get("month") ?? "");
  const settlement = await settleMonth(month, founder.email);
  if (!settlement) return;
  const who = `${founderName(settlement.fromFounder)} sent ${founderName(settlement.toFounder)}`;
  await record(founder.email, "settled expenses by Zelle", { detail: `${who} ${formatCents(settlement.amountCents)} for ${monthName(month)}` });
  revalidatePath("/admin/expenses");
}
