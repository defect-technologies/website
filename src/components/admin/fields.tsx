import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const CONTROL =
  "bg-surface border-ink/15 w-full rounded-lg border px-3 py-2 text-base text-ink placeholder:text-ink-faint focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ink/20";

type Labelled = { label: string; hint?: ReactNode };

function FieldShell({ label, hint, htmlFor, children }: Labelled & { htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-ink-faint text-sm text-pretty">{hint}</p>}
    </div>
  );
}

export function TextField({ label, hint, id, name, className = "", ...rest }: Labelled & InputHTMLAttributes<HTMLInputElement>) {
  const fieldId = id ?? name ?? label;
  return (
    <FieldShell label={label} hint={hint} htmlFor={fieldId}>
      <input id={fieldId} name={name} className={`${CONTROL} ${className}`} {...rest} />
    </FieldShell>
  );
}

export function TextAreaField({ label, hint, id, name, className = "", ...rest }: Labelled & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const fieldId = id ?? name ?? label;
  return (
    <FieldShell label={label} hint={hint} htmlFor={fieldId}>
      <textarea id={fieldId} name={name} className={`${CONTROL} min-h-24 resize-y ${className}`} {...rest} />
    </FieldShell>
  );
}

export function SelectField({ label, hint, id, name, className = "", children, ...rest }: Labelled & SelectHTMLAttributes<HTMLSelectElement>) {
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
