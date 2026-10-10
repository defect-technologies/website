"use client";

import { Plus } from "@phosphor-icons/react";
import { useActionState } from "react";
import { addExpenseAction, type AddExpenseResult } from "@/app/admin/(panel)/expenses/actions";
import { FREQUENCIES, FREQUENCY_LABEL } from "@/lib/recurrence";
import SubmitButton from "./SubmitButton";
import { controlClass, TextField } from "./fields";
import { Card, Notice } from "./ui";

export type FounderOption = { email: string; name: string };
type Option = { value: string; label: string };

const FREQUENCY_OPTIONS: Option[] = FREQUENCIES.map((frequency) => ({ value: frequency, label: FREQUENCY_LABEL[frequency] }));

/** A row of radio buttons drawn as one pill, for a choice between a few short options. */
function Segmented({ legend, name, options, selected }: { legend: string; name: string; options: Option[]; selected: string }) {
  return (
    <fieldset className="flex flex-col">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="bg-paper-shade flex rounded-full p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="text-ink-soft has-checked:bg-surface has-checked:text-ink has-checked:shadow-card has-focus-visible:outline-ink flex min-h-9 flex-1 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 has-focus-visible:outline-2"
          >
            <input type="radio" name={name} value={option.value} defaultChecked={option.value === selected} required className="sr-only" />
            {option.label}
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
  const empty: AddExpenseResult = { problems: [], values: { spentOn: today, item: "", amount: "", paidBy: signedIn, frequency: "one_time" } };
  const [state, action] = useActionState(addExpenseAction, empty);
  const { values } = state;

  return (
    <form action={action} className="flex flex-col gap-3">
      <Problems problems={state.problems} />
      <Card key={state.addedId ?? "first"} className="flex flex-col gap-4 p-5">
        <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[9.5rem_minmax(0,1fr)_8rem]">
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
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <Segmented legend="How often" name="frequency" options={FREQUENCY_OPTIONS} selected={values.frequency} />
          <Segmented legend="Paid by" name="paidBy" options={founders.map((founder) => ({ value: founder.email, label: founder.name }))} selected={values.paidBy} />
          <SubmitButton variant="solid" className="sm:ml-auto" icon={<Plus size={18} weight="bold" aria-hidden="true" />}>
            Add expense
          </SubmitButton>
        </div>
      </Card>
    </form>
  );
}
