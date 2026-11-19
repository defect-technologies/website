"use client";

import { Plus, Wallet } from "@phosphor-icons/react";
import { useActionState } from "react";
import { addDesignerAction, type FormState, recordPaymentAction } from "@/app/admin/(panel)/setup/designers/actions";
import SubmitButton from "../SubmitButton";
import { controlClass, TextField } from "../fields";
import { Card, Notice, Problems } from "../ui";

const EMPTY: FormState = { problems: [] };

function Outcome({ state }: { state: FormState }) {
  if (state.problems.length) return <Problems problems={state.problems} />;
  return state.done ? <Notice tone="good">{state.done}</Notice> : null;
}

/** Adds a designer by the email of the Google account they sign in with. */
export function AddDesignerForm() {
  const [state, action] = useActionState(addDesignerAction, EMPTY);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Outcome state={state} />
      <Card key={state.done ?? "first"} className="grid items-end gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
        <TextField label="Name" name="name" required autoComplete="off" />
        <TextField label="Google account email" name="email" type="email" required autoComplete="off" placeholder="name@example.com" />
        <SubmitButton variant="solid" icon={<Plus size={18} weight="bold" aria-hidden="true" />}>
          Add designer
        </SubmitButton>
      </Card>
    </form>
  );
}

/** Records a Zelle a founder sent this designer. */
export function RecordPaymentForm({ designerId, today, owedCents }: { designerId: string; today: string; owedCents: number }) {
  const [state, action] = useActionState(recordPaymentAction, EMPTY);
  const suggested = owedCents > 0 ? (owedCents / 100).toFixed(2) : "";
  return (
    <form action={action} className="flex flex-col gap-3">
      <Outcome state={state} />
      <Card key={state.done ?? "first"} className="flex flex-col gap-4 p-5">
        <input type="hidden" name="designerId" value={designerId} />
        <div className="grid items-end gap-4 sm:grid-cols-[9.5rem_8rem_minmax(0,1fr)]">
          <TextField label="Date sent" name="paidOn" type="date" required defaultValue={today} max={today} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="payment-amount" className="text-sm font-medium">
              Amount
            </label>
            <div className="relative">
              <span aria-hidden="true" className="text-ink-faint pointer-events-none absolute inset-y-0 left-3 flex items-center">
                $
              </span>
              <input id="payment-amount" name="amount" inputMode="decimal" required defaultValue={suggested} placeholder="59.00" autoComplete="off" className={`${controlClass} pl-7 text-right tabular-nums`} />
            </div>
          </div>
          <TextField label="Note (optional)" name="note" maxLength={300} autoComplete="off" />
        </div>
        <SubmitButton variant="solid" className="w-fit" icon={<Wallet size={18} aria-hidden="true" />}>
          Record payment
        </SubmitButton>
      </Card>
    </form>
  );
}
