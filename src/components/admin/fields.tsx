import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { ComponentProps, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

const CONTROL =
  "bg-surface border-ink/15 w-full rounded-lg border px-3 py-2 text-base text-ink placeholder:text-ink-faint focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ink/20";

/** error is shown under the field, and the control points to it so screen readers read it with the field. */
type Labelled = { label: string; hint?: ReactNode; error?: string };

function FieldShell({ label, hint, error, htmlFor, children }: Labelled & { htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${htmlFor}-hint`} className="text-ink-faint text-sm text-pretty">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="text-bad flex items-start gap-1.5 text-sm font-medium text-pretty">
          <WarningCircle size={18} weight="fill" className="mt-px shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(fieldId: string, { hint, error }: Pick<Labelled, "hint" | "error">) {
  return [hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(" ") || undefined;
}

const INVALID = "aria-invalid:border-bad";

export function TextField({ label, hint, error, id, name, className = "", ...rest }: Labelled & InputHTMLAttributes<HTMLInputElement>) {
  const fieldId = id ?? name ?? label;
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={fieldId}>
      <input id={fieldId} name={name} aria-invalid={error ? true : undefined} aria-describedby={describedBy(fieldId, { hint, error })} className={`${CONTROL} ${INVALID} ${className}`} {...rest} />
    </FieldShell>
  );
}

export function TextAreaField({ label, hint, error, id, name, className = "", ...rest }: Labelled & ComponentProps<"textarea">) {
  const fieldId = id ?? name ?? label;
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={fieldId}>
      <textarea id={fieldId} name={name} aria-invalid={error ? true : undefined} aria-describedby={describedBy(fieldId, { hint, error })} className={`${CONTROL} ${INVALID} min-h-24 resize-y ${className}`} {...rest} />
    </FieldShell>
  );
}

export function SelectField({ label, hint, id, name, className = "", children, ...rest }: Omit<Labelled, "error"> & SelectHTMLAttributes<HTMLSelectElement>) {
  const fieldId = id ?? name ?? label;
  return (
    <FieldShell label={label} hint={hint} htmlFor={fieldId}>
      <select id={fieldId} name={name} className={`${CONTROL} ${className}`} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}

export const controlClass = CONTROL;
