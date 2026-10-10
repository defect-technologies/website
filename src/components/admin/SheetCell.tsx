"use client";

import { useState, useTransition, type KeyboardEvent } from "react";
import type { CellResult } from "@/app/admin/(panel)/expenses/actions";

type Option = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  save: (value: string) => Promise<CellResult>;
  type?: "text" | "date" | "amount";
  options?: readonly Option[];
  max?: string;
};

const BASE =
  "w-full min-w-0 rounded-md bg-transparent px-2 py-1.5 text-sm text-ink outline-none transition-[background-color,box-shadow] duration-150 hover:bg-paper-shade/70 focus:bg-surface focus:ring-2 focus:ring-ink/25 aria-invalid:ring-2 aria-invalid:ring-bad/60 disabled:opacity-60";

/** A spreadsheet cell: looks like text, edits in place, saves on Enter or leaving the cell, and Esc puts it back. */
export default function SheetCell({ label, value, save, type = "text", options, max }: Props) {
  const [draft, setDraft] = useState(value);
  const [problem, setProblem] = useState<string>();
  const [saving, startSaving] = useTransition();
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }

  function commit(next: string) {
    if (next.trim() === value.trim()) return setProblem(undefined);
    startSaving(async () => setProblem((await save(next)).problem));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key !== "Escape") return;
    setDraft(value);
    setProblem(undefined);
    requestAnimationFrame(() => (event.target as HTMLInputElement).blur());
  }

  const shared = { "aria-label": label, "aria-invalid": problem ? true : undefined, disabled: saving, title: problem };
  const message = problem && (
    <p role="alert" className="bg-bad text-paper absolute top-full left-0 z-10 mt-1 w-max max-w-64 rounded-md px-2 py-1 text-sm shadow-lifted">
      {problem}
    </p>
  );

  if (options) {
    return (
      <div className="relative">
        <select
          {...shared}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            commit(event.target.value);
          }}
          className={`${BASE} cursor-pointer`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {message}
      </div>
    );
  }

  const isAmount = type === "amount";
  return (
    <div className="relative">
      {isAmount && (
        <span aria-hidden="true" className="text-ink-faint pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm">
          $
        </span>
      )}
      <input
        {...shared}
        type={isAmount ? "text" : type}
        inputMode={isAmount ? "decimal" : undefined}
        max={max}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={onKeyDown}
        className={`${BASE} ${isAmount ? "pl-5 text-right tabular-nums" : ""}`}
      />
      {message}
    </div>
  );
}
