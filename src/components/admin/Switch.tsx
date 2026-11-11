import type { InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & { label: string; hideLabel?: boolean };

/** An on/off control that submits with its form. The track and knob show the state; the label names what it switches. */
export default function Switch({ label, hideLabel = false, className = "", ...input }: Props) {
  return (
    <label className={`relative inline-flex min-h-11 cursor-pointer items-center gap-3 ${className}`}>
      <input type="checkbox" role="switch" className="peer sr-only" {...input} />
      <span
        aria-hidden="true"
        className="bg-ink/20 peer-checked:bg-ink peer-focus-visible:outline-ink after:bg-surface relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-40 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:shadow-sm after:transition-transform after:duration-150 peer-checked:after:translate-x-4 motion-reduce:transition-none motion-reduce:after:transition-none"
      />
      <span className={hideLabel ? "sr-only" : "text-base font-medium"}>{label}</span>
    </label>
  );
}
