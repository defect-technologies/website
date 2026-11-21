"use client";

import { Plus } from "@phosphor-icons/react";
import { useActionState } from "react";
import { addDesignerAction, type FormState } from "@/app/admin/(panel)/setup/designers/actions";
import SubmitButton from "../SubmitButton";
import { TextField } from "../fields";
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
