import { ArrowRight, CheckCircle, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { buttonClasses } from "@/components/Button";
import AddExpenseForm from "@/components/admin/AddExpenseForm";
import DeleteExpenseButton from "@/components/admin/DeleteExpenseButton";
import EmptyState from "@/components/admin/EmptyState";
import KnifeStroke from "@/components/admin/KnifeStroke";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, KeyValue, PageHeader } from "@/components/admin/ui";
import { FOUNDER_EMAILS, FOUNDERS, founderName } from "@/lib/founders";
import { formatCents, monthName, monthOf, todayInPacific, type MonthBalance } from "@/lib/settleUp";
import { requireFounder } from "@/server/auth/session";
import type { Expense } from "@/server/db/schema";
import { balances } from "@/server/expenses/expenses";
import { settleMonthAction } from "./actions";

export const metadata: Metadata = { title: "Expenses" };

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dayOf = (spentOn: string) => shortDate.format(new Date(`${spentOn}T00:00:00Z`));

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

function MonthTable({ balance, expenses }: { balance: MonthBalance; expenses: Expense[] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`month-${balance.month}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`month-${balance.month}`} className="flex items-baseline gap-2 text-lg font-semibold">
          {monthName(balance.month)}
          <span className="text-ink-faint font-normal tabular-nums">{formatCents(balance.totalCents)}</span>
        </h2>
        <MonthStatus balance={balance} />
      </div>
      {expenses.length > 0 && (
        <Card>
          <table className="w-full table-fixed text-left text-sm">
            <thead className="text-ink-faint">
              <tr>
                <th scope="col" className="w-20 px-4 py-3 font-medium sm:w-24 sm:px-5">Date</th>
                <th scope="col" className="px-2 py-3 font-medium sm:px-5">What it was for</th>
                <th scope="col" className="hidden w-36 px-5 py-3 font-medium sm:table-cell">Paid by</th>
                <th scope="col" className="w-24 px-2 py-3 text-right font-medium sm:w-28 sm:px-5">Amount</th>
                <th scope="col" className="w-14 py-3 pr-2"><span className="sr-only">Delete</span></th>
              </tr>
            </thead>
            <tbody className="divide-ink/8 divide-y">
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td className="text-ink-soft px-4 py-2 whitespace-nowrap tabular-nums sm:px-5">{dayOf(expense.spentOn)}</td>
                  <td className="px-2 py-2 sm:px-5">
                    <span className="block font-medium break-words">{expense.item}</span>
                    <span className="text-ink-faint block sm:hidden">{founderName(expense.paidBy)}</span>
                  </td>
                  <td className="text-ink-soft hidden px-5 py-2 sm:table-cell">{founderName(expense.paidBy)}</td>
                  <td className="px-2 py-2 text-right tabular-nums sm:px-5">{formatCents(expense.amountCents)}</td>
                  <td className="relative py-1 pr-2 text-right">
                    <DeleteExpenseButton id={expense.id} item={expense.item} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
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
  const { expenses, months } = await balances();
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
      {months.length === 0 ? (
        <EmptyState title="No expenses yet">Add anything one of you paid for the business. Each month&apos;s total is split evenly, and whoever paid less sends the difference by Zelle.</EmptyState>
      ) : (
        months.map((balance) => <MonthTable key={balance.month} balance={balance} expenses={expenses.filter((expense) => monthOf(expense.spentOn) === balance.month)} />)
      )}
    </>
  );
}
