import { ArrowsClockwise, Trash } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { deleteExpenseAction, stopRecurringAction, updateExpenseCellAction, updateRecurringCellAction } from "@/app/admin/(panel)/expenses/actions";
import { FOUNDERS } from "@/lib/founders";
import { FREQUENCY_LABEL, nextDue } from "@/lib/recurrence";
import type { Expense, ExpenseFrequency, RecurringExpense } from "@/server/db/schema";
import ConfirmRowButton from "./ConfirmRowButton";
import SheetCell from "./SheetCell";
import { Card } from "./ui";

const FOUNDER_OPTIONS = FOUNDERS.map((founder) => ({ value: founder.email, label: founder.name }));

const centsToDollars = (cents: number) => (cents / 100).toFixed(2);

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const dateLabel = (date: string) => shortDate.format(new Date(`${date}T00:00:00Z`));

function Head({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th scope="col" className={`px-4 py-3 font-medium ${className}`}>
      {children}
    </th>
  );
}

function Frequency({ frequency }: { frequency: ExpenseFrequency | null }) {
  if (!frequency) return <span className="text-ink-faint px-2">One time</span>;
  return (
    <span className="text-ink inline-flex items-center gap-1.5 px-2">
      <ArrowsClockwise size={16} aria-hidden="true" />
      {FREQUENCY_LABEL[frequency]}
    </span>
  );
}

/** A table that scrolls sideways on a phone instead of squeezing its cells. */
function Sheet({ children }: { children: ReactNode }) {
  return (
    <Card className="relative overflow-x-auto">
      <table className="w-full min-w-[44rem] table-fixed text-left text-sm">{children}</table>
    </Card>
  );
}

function ExpenseRow({ expense, frequency, today }: { expense: Expense; frequency: ExpenseFrequency | null; today: string }) {
  const save = (cell: Parameters<typeof updateExpenseCellAction>[1]) => updateExpenseCellAction.bind(null, expense.id, cell);
  return (
    <tr>
      <td className="px-2 py-1">
        <SheetCell label={`Date of ${expense.item}`} type="date" max={today} value={expense.spentOn} save={save("spentOn")} />
      </td>
      <td className="px-2 py-1">
        <SheetCell label="What it was for" value={expense.item} save={save("item")} />
      </td>
      <td className="px-2 py-1">
        <Frequency frequency={frequency} />
      </td>
      <td className="px-2 py-1">
        <SheetCell label={`Who paid for ${expense.item}`} value={expense.paidBy} options={FOUNDER_OPTIONS} save={save("paidBy")} />
      </td>
      <td className="px-2 py-1">
        <SheetCell label={`Amount for ${expense.item}`} type="amount" value={centsToDollars(expense.amountCents)} save={save("amount")} />
      </td>
      <td className="relative py-1 pr-2 text-right">
        <ConfirmRowButton action={deleteExpenseAction} id={expense.id} label={`Delete ${expense.item}`} confirmLabel="Delete" icon={<Trash size={18} aria-hidden="true" />} />
      </td>
    </tr>
  );
}

export function MonthSheet({ expenses, frequencies, today }: { expenses: Expense[]; frequencies: Map<string, ExpenseFrequency>; today: string }) {
  return (
    <Sheet>
      <thead className="text-ink-faint">
        <tr>
          <Head className="w-40">Date</Head>
          <Head>What it was for</Head>
          <Head className="w-32">How often</Head>
          <Head className="w-32">Paid by</Head>
          <Head className="w-32 text-right">Amount</Head>
          <Head className="w-14"><span className="sr-only">Delete</span></Head>
        </tr>
      </thead>
      <tbody className="divide-ink/8 divide-y">
        {expenses.map((expense) => (
          <ExpenseRow key={expense.id} expense={expense} frequency={expense.recurringId ? (frequencies.get(expense.recurringId) ?? null) : null} today={today} />
        ))}
      </tbody>
    </Sheet>
  );
}

function RecurringRow({ recurring, today }: { recurring: RecurringExpense; today: string }) {
  const save = (cell: Parameters<typeof updateRecurringCellAction>[1]) => updateRecurringCellAction.bind(null, recurring.id, cell);
  const next = nextDue(recurring, today);
  return (
    <tr>
      <td className="px-2 py-1">
        <SheetCell label="What it's for" value={recurring.item} save={save("item")} />
      </td>
      <td className="px-2 py-1">
        <Frequency frequency={recurring.frequency} />
      </td>
      <td className="text-ink-soft px-4 py-1 tabular-nums">{next && dateLabel(next)}</td>
      <td className="px-2 py-1">
        <SheetCell label={`Who pays for ${recurring.item}`} value={recurring.paidBy} options={FOUNDER_OPTIONS} save={save("paidBy")} />
      </td>
      <td className="px-2 py-1">
        <SheetCell label={`Amount for ${recurring.item}`} type="amount" value={centsToDollars(recurring.amountCents)} save={save("amount")} />
      </td>
      <td className="relative py-1 pr-2 text-right">
        <ConfirmRowButton action={stopRecurringAction} id={recurring.id} label={`Stop ${recurring.item}`} confirmLabel="Stop" />
      </td>
    </tr>
  );
}

/** Repeating expenses still running. Edits here change the next charge on, not the months already in the sheet. */
export function RecurringSheet({ recurring, today }: { recurring: RecurringExpense[]; today: string }) {
  return (
    <Sheet>
      <thead className="text-ink-faint">
        <tr>
          <Head>What it&apos;s for</Head>
          <Head className="w-32">How often</Head>
          <Head className="w-40">Next charge</Head>
          <Head className="w-32">Paid by</Head>
          <Head className="w-32 text-right">Amount</Head>
          <Head className="w-20"><span className="sr-only">Stop</span></Head>
        </tr>
      </thead>
      <tbody className="divide-ink/8 divide-y">
        {recurring.map((row) => (
          <RecurringRow key={row.id} recurring={row} today={today} />
        ))}
      </tbody>
    </Sheet>
  );
}
