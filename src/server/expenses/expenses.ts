import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { FOUNDER_EMAILS } from "@/lib/founders";
import { monthlyBalances } from "@/lib/settleUp";
import { db } from "../db/client";
import { expenses, settlements } from "../db/schema";

export async function allExpenses() {
  return (await db()).select().from(expenses).orderBy(desc(expenses.spentOn), desc(expenses.createdAt));
}

export async function addExpense(input: { spentOn: string; item: string; amountCents: number; paidBy: string; createdBy: string }) {
  const [row] = await (await db()).insert(expenses).values(input).returning();
  return row;
}

export async function deleteExpense(id: string) {
  const [row] = await (await db()).delete(expenses).where(eq(expenses.id, id)).returning();
  return row ?? null;
}

async function allSettlements() {
  return (await db()).select().from(settlements).orderBy(asc(settlements.sentAt));
}

export async function balances() {
  const [expenseRows, settlementRows] = await Promise.all([allExpenses(), allSettlements()]);
  const sent = settlementRows.map((row) => ({ month: row.month, from: row.fromFounder, to: row.toFounder, amountCents: row.amountCents }));
  return { expenses: expenseRows, months: monthlyBalances([FOUNDER_EMAILS[0], FOUNDER_EMAILS[1]], expenseRows, sent) };
}

/** Records the Zelle that evens out a month. Returns null when nothing was owed. */
export async function settleMonth(month: string, recordedBy: string) {
  const { months } = await balances();
  const owed = months.find((balance) => balance.month === month)?.owed;
  if (!owed) return null;
  const [row] = await (await db())
    .insert(settlements)
    .values({ month, fromFounder: owed.from, toFounder: owed.to, amountCents: owed.amountCents, recordedBy })
    .returning();
  return row;
}
