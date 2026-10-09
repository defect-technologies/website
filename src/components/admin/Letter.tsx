import { Fragment, type ReactNode } from "react";
import type { Placeholder, TemplateValues } from "@/lib/emailTemplate";

type Segment = { text: string; placeholder?: Placeholder };

/** Splits a template into its fixed words and the per-lead values that get filled in. */
export function segmentsOf(template: string, values: Partial<TemplateValues>): Segment[][] {
  return template.split("\n").map((line) =>
    line.split(/(\{\w+\})/).filter(Boolean).map((part) => {
      const name = part.match(/^\{(\w+)\}$/)?.[1] as Placeholder | undefined;
      const value = name ? values[name] : undefined;
      return value === undefined ? { text: part } : { text: value, placeholder: name };
    }),
  );
}

type LetterProps = {
  subject: string;
  template: string;
  values: Partial<TemplateValues>;
  /** Swaps a filled-in value for something else, such as an edit control. */
  renderValue?: (segment: Required<Segment>) => ReactNode;
};

/**
 * The email exactly as it will be sent. Each line is its own paragraph, and
 * everything that changes from lead to lead sits on a shaded mark.
 */
export default function Letter({ subject, template, values, renderValue }: LetterProps) {
  return (
    <div className="bg-paper flex flex-col gap-3 rounded-xl p-4 sm:p-5">
      <p className="font-semibold">{subject}</p>
      <div className="flex flex-col gap-1.5 leading-relaxed text-pretty">
        {segmentsOf(template, values).map((line, index) => (
          <p key={index} className="min-h-[1lh]">
            {line.map((segment, part) => (
              <Fragment key={part}>
                {segment.placeholder ? (
                  (renderValue?.(segment as Required<Segment>) ?? <mark className="bg-paper-shade text-ink rounded px-0.5">{segment.text}</mark>)
                ) : (
                  segment.text
                )}
              </Fragment>
            ))}
          </p>
        ))}
      </div>
    </div>
  );
}
