import { CheckCircle, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { buttonClasses } from "@/components/Button";
import AddExpenseForm from "@/components/admin/AddExpenseForm";
import EmptyState from "@/components/admin/EmptyState";
import { MonthSheet, RecurringSheet } from "@/components/admin/ExpenseSheets";
import SettleCard from "@/components/admin/SettleCard";
import ClientsSummary from "@/components/admin/overview/ClientsSummary";
import { PageHeader, SectionHeading } from "@/components/admin/ui";
import { FOUNDERS, founderName } from "@/lib/founders";
import { formatCents, monthName, monthOf, todayInPacific, type MonthBalance } from "@/lib/settleUp";
import { requireFounder } from "@/server/auth/session";
import type { Expense, ExpenseFrequency, RecurringExpense } from "@/server/db/schema";
import { balances } from "@/server/expenses/expenses";
import { stripeSummary } from "@/server/integrations/stripe";

export const metadata: Metadata = { title: "Money" };

function MonthStatus({ balance }: { balance: MonthBalance }) {
  if (balance.owed) {
    return (
      <span className="text-ink-soft text-sm">
        {founderName(balance.owed.from)} owes {founderName(balance.owed.to)} {formatCents(balance.owed.amountCents)}
      </span>
    );
  }
  return (
    <span className="text-good inline-flex items-center gap-1.5 text-sm font-medium">
      <CheckCircle size={16} weight="fill" aria-hidden="true" />
      {balance.sent.length > 0 ? "Settled" : "Even"}
    </span>
  );
}

type SheetProps = { frequencies: Map<string, ExpenseFrequency>; today: string };

function MonthTable({ balance, expenses, frequencies, today }: SheetProps & { balance: MonthBalance; expenses: Expense[] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`month-${balance.month}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`month-${balance.month}`} className="flex items-baseline gap-2 text-lg font-semibold">
          {monthName(balance.month)}
          <span className="text-ink-faint font-normal tabular-nums">{formatCents(balance.totalCents)}</span>
        </h2>
        <MonthStatus balance={balance} />
      </div>
      {expenses.length > 0 && <MonthSheet expenses={expenses} frequencies={frequencies} today={today} />}
    </section>
  );
}

function Repeating({ recurring, today }: { recurring: RecurringExpense[]; today: string }) {
  const running = recurring.filter((row) => !row.stoppedOn);
  if (running.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading count={running.length}>Repeating</SectionHeading>
      <RecurringSheet recurring={running} today={today} />
    </section>
  );
}

function SettleUp({ months, thisMonth }: { months: MonthBalance[]; thisMonth: string }) {
  const open = months.filter((balance) => balance.owed);
  if (open.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {open.map((balance) => (
        <SettleCard key={balance.month} balance={balance} isDue={balance.month < thisMonth} />
      ))}
    </div>
  );
}

export default async function MoneyPage() {
  const founder = await requireFounder();
  const [{ expenses, recurring, months }, revenue] = await Promise.all([balances(), stripeSummary()]);
  const frequencies = new Map(recurring.map((row) => [row.id, row.frequency]));
  const today = todayInPacific();
  const csvLink = (
    <a href="/admin/money/export" className={buttonClasses("ghost", "sm")}>
      <DownloadSimple size={16} aria-hidden="true" />
      Download CSV
    </a>
  );

  return (
    <>
      <PageHeader title="Money">{expenses.length > 0 && csvLink}</PageHeader>
      <ClientsSummary money={revenue} />
      <SettleUp months={months} thisMonth={monthOf(today)} />
      <AddExpenseForm founders={[...FOUNDERS]} signedIn={founder.email} today={today} />
      <Repeating recurring={recurring} today={today} />
      {months.length === 0 ? (
        <EmptyState title="No expenses yet" />
      ) : (
        months.map((balance) => <MonthTable key={balance.month} balance={balance} expenses={expenses.filter((expense) => monthOf(expense.spentOn) === balance.month)} frequencies={frequencies} today={today} />)
      )}
    </>
  );
}
