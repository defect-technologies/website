import { founderName } from "@/lib/founders";
import { requireFounder } from "@/server/auth/session";
import { FREQUENCY_LABEL } from "@/lib/recurrence";
import { balances } from "@/server/expenses/expenses";

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export async function GET() {
  await requireFounder();
  const { expenses, recurring } = await balances();
  const frequencies = new Map(recurring.map((row) => [row.id, FREQUENCY_LABEL[row.frequency]]));
  const frequencyOf = (recurringId: string | null) => (recurringId && frequencies.get(recurringId)) || FREQUENCY_LABEL.one_time;
  const lines = [
    ["Date", "What it was for", "How often", "Amount", "Paid by"],
    ...expenses.map((expense) => [expense.spentOn, expense.item, frequencyOf(expense.recurringId), (expense.amountCents / 100).toFixed(2), founderName(expense.paidBy)]),
  ];
  const csv = lines.map((line) => line.map(csvCell).join(",")).join("\n");
  return new Response(`${csv}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="defect-expenses.csv"',
    },
  });
}
