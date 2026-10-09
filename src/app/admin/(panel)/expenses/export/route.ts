import { founderName } from "@/lib/settleUp";
import { requireFounder } from "@/server/auth/session";
import { allExpenses } from "@/server/expenses/expenses";

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export async function GET() {
  await requireFounder();
  const expenses = await allExpenses();
  const lines = [
    ["Date", "What it was for", "Amount", "Paid by"],
    ...expenses.map((expense) => [expense.spentOn, expense.item, (expense.amountCents / 100).toFixed(2), founderName(expense.paidBy)]),
  ];
  const csv = lines.map((line) => line.map(csvCell).join(",")).join("\n");
  return new Response(`${csv}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="defect-expenses.csv"',
    },
  });
}
