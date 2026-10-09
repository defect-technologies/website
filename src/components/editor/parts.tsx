"use client";

import { ArrowDown, ArrowUp, Trash } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { TextAreaField, TextField } from "@/components/admin/fields";
import { Card } from "@/components/admin/ui";

export function FormSection({ id, title, children, action }: { id: string; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-6" role="group" aria-labelledby={id}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Shows how much room is left once a field gets close to its limit. */
function remaining(value: string, max: number): string | undefined {
  const left = max - value.length;
  if (left > Math.max(10, max * 0.2)) return undefined;
  return left === 1 ? "1 character left" : `${left} characters left`;
}

type LimitedProps = { id: string; label: string; value: string; max: number; onChange: (value: string) => void; hint?: string; multiline?: boolean; required?: boolean; placeholder?: string };

export function LimitedText({ id, label, value, max, onChange, hint, multiline = false, required, placeholder }: LimitedProps) {
  const shared = { id, label, value, maxLength: max, required, placeholder, hint: remaining(value, max) ?? hint };
  if (multiline) return <TextAreaField {...shared} rows={4} onChange={(event) => onChange(event.target.value.replace(/\s*\n\s*/g, " "))} />;
  return <TextField {...shared} onChange={(event) => onChange(event.target.value)} />;
}

type RowControlsProps = { name: string; index: number; count: number; onMove: (to: number) => void; onRemove?: () => void };

/** Move up, move down, and remove, each named after the row so screen readers know which one. */
export function RowControls({ name, index, count, onMove, onRemove }: RowControlsProps) {
  return (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => onMove(index - 1)}>
        <ArrowUp size={18} aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon" aria-label={`Move ${name} down`} disabled={index === count - 1} onClick={() => onMove(index + 1)}>
        <ArrowDown size={18} aria-hidden="true" />
      </Button>
      {onRemove && (
        <Button variant="ghost" size="icon" aria-label={`Remove ${name}`} onClick={onRemove} className="hover:text-bad">
          <Trash size={18} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
