"use client";

import { UploadSimple } from "@phosphor-icons/react";
import { useActionState } from "react";
import { importAction, type FormResult } from "@/app/admin/(panel)/pipeline/actions";
import SubmitButton from "./SubmitButton";
import { Notice } from "./ui";

export default function ImportForm() {
  const [state, action] = useActionState(importAction, { ok: false, message: "" } as FormResult);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="csv" className="sr-only">
          leads.csv from the lead finder
        </label>
        <input
          id="csv"
          name="csv"
          type="file"
          accept=".csv,text/csv"
          required
          className="text-ink-soft file:bg-paper-shade file:text-ink max-w-full text-sm file:mr-3 file:min-h-9 file:rounded-full file:border-0 file:px-3.5 file:text-sm file:font-medium"
        />
        <SubmitButton size="sm" variant="solid" icon={<UploadSimple size={16} weight="bold" aria-hidden="true" />}>
          Import leads.csv
        </SubmitButton>
      </div>
      {state.message && <Notice tone={state.ok ? "good" : "bad"}>{state.message}</Notice>}
    </form>
  );
}
