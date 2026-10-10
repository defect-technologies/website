import "server-only";
import { asc, eq } from "drizzle-orm";
import { datesDue } from "@/lib/recurrence";
import { todayInPacific } from "@/lib/settleUp";
import { db } from "../db/client";
import { expenses, recurringExpenses, type ExpenseFrequency, type RecurringExpense } from "../db/schema";

export async function allRecurring() {
  return (await db()).select().from(recurringExpenses).orderBy(asc(recurringExpenses.item));
}

/** Adds a row to expenses for each time a repeating expense came due since the last check. Safe to run on every page load. */
async function addDueRows(recurring: RecurringExpense, today: string) {
  const dates = datesDue(recurring, today);
  if (dates.length === 0) return;
  const database = await db();
  const { item, amountCents, paidBy, createdBy } = recurring;
  await database
    .insert(expenses)
    .values(dates.map((spentOn) => ({ spentOn, item, amountCents, paidBy, createdBy, recurringId: recurring.id })))
    .onConflictDoNothing();
  await database.update(recurringExpenses).set({ addedThrough: today }).where(eq(recurringExpenses.id, recurring.id));
}

export async function addAllDueRows(today = todayInPacific()) {
  const all = await allRecurring();
  await Promise.all(all.map((recurring) => addDueRows(recurring, today)));
}

export async function addRecurring(input: { item: string; amountCents: number; paidBy: string; frequency: ExpenseFrequency; startsOn: string; createdBy: string }) {
  const [row] = await (await db()).insert(recurringExpenses).values(input).returning();
  await addDueRows(row, todayInPacific());
  return row;
}

type RecurringChange = Partial<Pick<RecurringExpense, "item" | "amountCents" | "paidBy">>;

/** Changes what future rows will say. Rows already added keep their own values. */
export async function updateRecurring(id: string, change: RecurringChange) {
  const [row] = await (await db()).update(recurringExpenses).set(change).where(eq(recurringExpenses.id, id)).returning();
  return row ?? null;
}

export async function stopRecurring(id: string) {
  const [row] = await (await db()).update(recurringExpenses).set({ stoppedOn: todayInPacific() }).where(eq(recurringExpenses.id, id)).returning();
  return row ?? null;
}
