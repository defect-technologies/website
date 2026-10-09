/**
 * Each month's expenses are split evenly between the two founders. Whoever paid
 * less sends the other half the difference by Zelle, once, after the month ends.
 */

export type Transfer = { from: string; to: string; amountCents: number };

type ExpenseLine = { spentOn: string; amountCents: number; paidBy: string };
type SentTransfer = Transfer & { month: string };

export type MonthBalance = {
  month: string;
  totalCents: number;
  paidCents: Record<string, number>;
  owed: Transfer | null;
  sent: SentTransfer[];
};

export const monthOf = (spentOn: string) => spentOn.slice(0, 7);

function sumBy<T>(rows: T[], key: (row: T) => string, cents: (row: T) => number) {
  const totals: Record<string, number> = {};
  for (const row of rows) totals[key(row)] = (totals[key(row)] ?? 0) + cents(row);
  return totals;
}

/** What one founder still owes the other for a month, after any Zelles already sent. */
export function remainingTransfer([first, second]: [string, string], paidCents: Record<string, number>, sent: Transfer[]): Transfer | null {
  const secondOwesFirst = Math.round(((paidCents[first] ?? 0) - (paidCents[second] ?? 0)) / 2);
  const alreadySentToFirst = sent.reduce((total, transfer) => total + (transfer.to === first ? transfer.amountCents : -transfer.amountCents), 0);
  const remaining = secondOwesFirst - alreadySentToFirst;
  if (remaining === 0) return null;
  return remaining > 0 ? { from: second, to: first, amountCents: remaining } : { from: first, to: second, amountCents: -remaining };
}

/** Newest month first. `owed` is null when the month is even, or when there aren't exactly two founders. */
export function monthlyBalances(founders: string[], expenses: ExpenseLine[], sent: SentTransfer[]): MonthBalance[] {
  const months = [...new Set([...expenses.map((expense) => monthOf(expense.spentOn)), ...sent.map((transfer) => transfer.month)])].sort().reverse();
  const pair = founders.length === 2 ? (founders as [string, string]) : null;
  return months.map((month) => {
    const inMonth = expenses.filter((expense) => monthOf(expense.spentOn) === month);
    const sentInMonth = sent.filter((transfer) => transfer.month === month);
    const paidCents = sumBy(inMonth, (expense) => expense.paidBy, (expense) => expense.amountCents);
    return {
      month,
      totalCents: inMonth.reduce((total, expense) => total + expense.amountCents, 0),
      paidCents,
      owed: pair ? remainingTransfer(pair, paidCents, sentInMonth) : null,
      sent: sentInMonth,
    };
  });
}

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const formatCents = (cents: number) => dollars.format(cents / 100);

/** "boris.nezlobin@example.com" reads as "Boris". */
export function founderName(email: string) {
  const first = email.split("@")[0].split(/[.+_-]/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** "2026-10" reads as "October 2026". */
export function monthName(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthIndex - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Today's date in Pacific time, as YYYY-MM-DD. */
export function todayInPacific(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now);
}
