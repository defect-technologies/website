"use client";

import { Plus } from "@phosphor-icons/react";
import { useActionState } from "react";
import { addExpenseAction, type AddExpenseResult } from "@/app/admin/(panel)/expenses/actions";
import SubmitButton from "./SubmitButton";
import { controlClass, TextField } from "./fields";
import { Card, Notice } from "./ui";

export type FounderOption = { email: string; name: string };

function PaidBy({ founders, selected }: { founders: FounderOption[]; selected: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">Paid by</legend>
      <div className="bg-paper-shade flex rounded-full p-1">
        {founders.map((founder) => (
          <label
            key={founder.email}
            className="text-ink-soft has-checked:bg-surface has-checked:text-ink has-checked:shadow-card has-focus-visible:outline-ink flex min-h-9 flex-1 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-medium transition-colors duration-150 has-focus-visible:outline-2"
          >
            <input type="radio" name="paidBy" value={founder.email} defaultChecked={founder.email === selected} required className="sr-only" />
            {founder.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Problems({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;
  return (
    <Notice tone="bad">
      <ul className={problems.length > 1 ? "list-disc pl-5" : ""}>
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </Notice>
  );
}

export default function AddExpenseForm({ founders, signedIn, today }: { founders: FounderOption[]; signedIn: string; today: string }) {
  const empty: AddExpenseResult = { problems: [], values: { spentOn: today, item: "", amount: "", paidBy: signedIn } };
  const [state, action] = useActionState(addExpenseAction, empty);
  const { values } = state;

  return (
    <form action={action} className="flex flex-col gap-3">
      <Problems problems={state.problems} />
      <Card key={state.addedId ?? "first"} className="grid items-end gap-4 p-5 sm:grid-cols-2 xl:grid-cols-[9.5rem_minmax(0,1fr)_8rem_auto_auto]">
        <TextField label="Date" name="spentOn" type="date" required defaultValue={values.spentOn} max={today} />
        <TextField label="What it was for" name="item" required defaultValue={values.item} placeholder="Vercel Pro" autoComplete="off" autoFocus={Boolean(state.addedId)} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="amount" className="text-sm font-medium">
            Amount
          </label>
          <div className="relative">
            <span aria-hidden="true" className="text-ink-faint pointer-events-none absolute inset-y-0 left-3 flex items-center">
              $
            </span>
            <input id="amount" name="amount" inputMode="decimal" required defaultValue={values.amount} placeholder="20.00" autoComplete="off" className={`${controlClass} pl-7 text-right tabular-nums`} />
          </div>
        </div>
        <PaidBy founders={founders} selected={values.paidBy} />
        <SubmitButton variant="solid" icon={<Plus size={18} weight="bold" aria-hidden="true" />}>
          Add expense
        </SubmitButton>
      </Card>
    </form>
  );
}
