"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FOUNDER_EMAILS, founderName } from "@/lib/founders";
import { FREQUENCIES, FREQUENCY_LABEL } from "@/lib/recurrence";
import { formatCents, monthName } from "@/lib/settleUp";
import { record } from "@/server/activity";
import { requireFounder } from "@/server/auth/session";
import { addExpense, deleteExpense, settleMonth, updateExpense } from "@/server/expenses/expenses";
import { addRecurring, stopRecurring, updateRecurring } from "@/server/expenses/recurring";

export type ExpenseValues = { spentOn: string; item: string; amount: string; paidBy: string; frequency: string };
export type AddExpenseResult = { problems: string[]; values: ExpenseValues; addedId?: string };
export type CellResult = { problem?: string };

const dollarsToCents = (amount: string) => Math.round(Number(amount.replace(/[$,\s]/g, "")) * 100);

const Field = {
  spentOn: z.iso.date("Pick the date it was paid."),
  item: z.string().trim().min(1, "Say what the expense was for.").max(200, "Keep what it was for under 200 characters."),
  amount: z
    .string()
    .regex(/^\s*\$?\s*[\d,]+(\.\d{1,2})?\s*$/, "The amount should be in dollars, like 20 or 8.40.")
    .transform(dollarsToCents)
    .refine((cents) => cents > 0, "The amount has to be more than $0."),
  paidBy: z.string().refine((email) => FOUNDER_EMAILS.includes(email), "Pick which founder paid."),
  frequency: z.enum(FREQUENCIES, "Pick how often it's paid."),
};

const NewExpense = z.object(Field);

function submittedValues(form: FormData): ExpenseValues {
  const field = (name: keyof ExpenseValues) => String(form.get(name) ?? "");
  return { spentOn: field("spentOn"), item: field("item"), amount: field("amount"), paidBy: field("paidBy"), frequency: field("frequency") };
}

const refresh = () => revalidatePath("/admin/expenses");

export async function addExpenseAction(_previous: AddExpenseResult, form: FormData): Promise<AddExpenseResult> {
  const founder = await requireFounder();
  const values = submittedValues(form);
  const parsed = NewExpense.safeParse(values);
  if (!parsed.success) return { problems: parsed.error.issues.map((issue) => issue.message), values };

  const { spentOn, item, amount, paidBy, frequency } = parsed.data;
  const common = { item, amountCents: amount, paidBy, createdBy: founder.email };
  const added = frequency === "one_time" ? await addExpense({ ...common, spentOn }) : await addRecurring({ ...common, frequency, startsOn: spentOn });
  const detail = `${item}, ${formatCents(amount)} ${FREQUENCY_LABEL[frequency].toLowerCase()}, paid by ${founderName(paidBy)} from ${spentOn}`;
  await record(founder.email, "added an expense", { detail });
  refresh();
  return { problems: [], values: { spentOn, item: "", amount: "", paidBy, frequency }, addedId: added.id };
}

/** Which column each editable cell writes, and how its text is checked. */
const CELLS = {
  spentOn: { column: "spentOn", schema: Field.spentOn },
  item: { column: "item", schema: Field.item },
  amount: { column: "amountCents", schema: Field.amount },
  paidBy: { column: "paidBy", schema: Field.paidBy },
} as const;

export type Cell = keyof typeof CELLS;

function parseCell(cell: Cell, value: string) {
  const rule = CELLS[cell];
  if (!rule) return { problem: "That column can't be edited." } as const;
  const parsed = rule.schema.safeParse(value);
  if (!parsed.success) return { problem: parsed.error.issues[0]?.message ?? "That value doesn't look right." } as const;
  return { change: { [rule.column]: parsed.data } } as const;
}

export async function updateExpenseCellAction(id: string, cell: Cell, value: string): Promise<CellResult> {
  const founder = await requireFounder();
  const parsed = parseCell(cell, value);
  if ("problem" in parsed) return { problem: parsed.problem };
  const updated = await updateExpense(id, parsed.change);
  if (!updated) return { problem: "That expense is gone. Reload the page." };
  await record(founder.email, "edited an expense", { detail: `${updated.item} on ${updated.spentOn}: ${cell} is now ${value.trim()}` });
  refresh();
  return {};
}

export async function updateRecurringCellAction(id: string, cell: Exclude<Cell, "spentOn">, value: string): Promise<CellResult> {
  const founder = await requireFounder();
  const parsed = parseCell(cell, value);
  if ("problem" in parsed) return { problem: parsed.problem };
  const updated = await updateRecurring(id, parsed.change);
  if (!updated) return { problem: "That repeating expense is gone. Reload the page." };
  await record(founder.email, "edited a repeating expense", { detail: `${updated.item}: ${cell} is now ${value.trim()} from the next charge on` });
  refresh();
  return {};
}

export async function stopRecurringAction(form: FormData) {
  const founder = await requireFounder();
  const stopped = await stopRecurring(String(form.get("id") ?? ""));
  if (!stopped) return;
  await record(founder.email, "stopped a repeating expense", { detail: `${stopped.item}, ${formatCents(stopped.amountCents)} ${FREQUENCY_LABEL[stopped.frequency].toLowerCase()}` });
  refresh();
}

export async function deleteExpenseAction(form: FormData) {
  const founder = await requireFounder();
  const removed = await deleteExpense(String(form.get("id") ?? ""));
  if (!removed) return;
  await record(founder.email, "deleted an expense", { detail: `${removed.item}, ${formatCents(removed.amountCents)}, from ${removed.spentOn}` });
  refresh();
}

export async function settleMonthAction(form: FormData) {
  const founder = await requireFounder();
  const month = String(form.get("month") ?? "");
  const settlement = await settleMonth(month, founder.email);
  if (!settlement) return;
  const who = `${founderName(settlement.fromFounder)} sent ${founderName(settlement.toFounder)}`;
  await record(founder.email, "settled expenses by Zelle", { detail: `${who} ${formatCents(settlement.amountCents)} for ${monthName(month)}` });
  refresh();
}
