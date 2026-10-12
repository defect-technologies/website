import type { Step } from "@/content/welcome";
import KnifeStroke from "../admin/KnifeStroke";

/** What happens after checkout, in order. Once they've paid, the knife stroke marks the step they're on. */
export default function SignUpSteps({ steps, current }: { steps: Step[]; current?: number }) {
  return (
    <ol className="grid gap-x-8 gap-y-10 sm:grid-cols-3">
      {steps.map((step, index) => {
        const here = index === current;
        return (
          <li key={step.title} aria-current={here ? "step" : undefined} className="flex flex-col gap-3">
            <span className="font-display relative isolate w-fit text-6xl leading-none font-black tabular-nums">
              {here && <KnifeStroke variant={index} className="text-vermilion/35 absolute -inset-x-3 inset-y-2 -z-10 h-[calc(100%-1rem)] w-[calc(100%+1.5rem)]" />}
              {index + 1}
            </span>
            <h3 className="text-ink text-lg font-semibold text-balance">{step.title}</h3>
            <p className="text-ink-soft text-pretty">{step.detail}</p>
          </li>
        );
      })}
    </ol>
  );
}
