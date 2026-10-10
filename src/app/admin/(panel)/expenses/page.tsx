import { ArrowRight, CheckCircle, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { buttonClasses } from "@/components/Button";
import AddExpenseForm from "@/components/admin/AddExpenseForm";
import EmptyState from "@/components/admin/EmptyState";
import { MonthSheet, RecurringSheet } from "@/components/admin/ExpenseSheets";
import KnifeStroke from "@/components/admin/KnifeStroke";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, KeyValue, PageHeader, SectionHeading } from "@/components/admin/ui";
import { FOUNDER_EMAILS, FOUNDERS, founderName } from "@/lib/founders";
import { formatCents, monthName, monthOf, todayInPacific, type MonthBalance } from "@/lib/settleUp";
import { requireFounder } from "@/server/auth/session";
import type { Expense, ExpenseFrequency, RecurringExpense } from "@/server/db/schema";
import { balances } from "@/server/expenses/expenses";
import { settleMonthAction } from "./actions";

export const metadata: Metadata = { title: "Expenses" };

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function lastDayOf(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return shortDate.format(new Date(Date.UTC(year, monthIndex, 0)));
}

function SettleCard({ balance, isDue }: { balance: MonthBalance; isDue: boolean }) {
  const owed = balance.owed!;
  return (
    <Card className="flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-4">
        <div>
          <p className="flex items-center gap-2 text-lg font-semibold">
            {founderName(owed.from)} <ArrowRight size={18} weight="bold" aria-label="sends" /> {founderName(owed.to)}
          </p>
          <p className="relative isolate w-fit">
            <KnifeStroke className="text-vermilion/25 absolute -inset-x-3 inset-y-1 -z-10 h-[calc(100%-0.5rem)] w-[calc(100%+1.5rem)]" />
            <span className="font-display text-6xl leading-none font-black tabular-nums">{formatCents(owed.amountCents)}</span>
          </p>
          <p className={isDue ? "text-ink mt-2 font-medium" : "text-ink-faint mt-2"}>
            {isDue ? `For ${monthName(balance.month)}. Send it now.` : `So far in ${monthName(balance.month)}. Send it after ${lastDayOf(balance.month)}.`}
          </p>
        </div>
        <KeyValue
          rows={[
            ...FOUNDER_EMAILS.map((email): [string, string] => [`${founderName(email)} paid`, formatCents(balance.paidCents[email] ?? 0)]),
            ["Total", formatCents(balance.totalCents)],
          ]}
        />
      </div>
      <form action={settleMonthAction}>
        <input type="hidden" name="month" value={balance.month} />
        <SubmitButton variant={isDue ? "solid" : "soft"} icon={<CheckCircle size={18} weight="bold" aria-hidden="true" />}>
          Mark as sent by Zelle
        </SubmitButton>
      </form>
    </Card>
  );
}

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

export default async function ExpensesPage() {
  const founder = await requireFounder();
  const { expenses, recurring, months } = await balances();
  const frequencies = new Map(recurring.map((row) => [row.id, row.frequency]));
  const today = todayInPacific();
  const csvLink = (
    <a href="/admin/expenses/export" className={buttonClasses("ghost", "sm")}>
      <DownloadSimple size={16} aria-hidden="true" />
      Download CSV
    </a>
  );

  return (
    <>
      <PageHeader title="Expenses">{expenses.length > 0 && csvLink}</PageHeader>
      <SettleUp months={months} thisMonth={monthOf(today)} />
      <AddExpenseForm founders={[...FOUNDERS]} signedIn={founder.email} today={today} />
      <Repeating recurring={recurring} today={today} />
      {months.length === 0 ? (
        <EmptyState title="No expenses yet">Add anything one of you paid for the business. Each month&apos;s total is split evenly, and whoever paid less sends the difference by Zelle.</EmptyState>
      ) : (
        months.map((balance) => <MonthTable key={balance.month} balance={balance} expenses={expenses.filter((expense) => monthOf(expense.spentOn) === balance.month)} frequencies={frequencies} today={today} />)
      )}
    </>
  );
}
