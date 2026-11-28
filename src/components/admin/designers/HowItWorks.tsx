import type { Icon } from "@phosphor-icons/react";
import { CaretRight, Eye, Handshake, Hammer, Swatches } from "@phosphor-icons/react/dist/ssr";

type Step = { icon: Icon; title: string; detail: string; yours: boolean };

const STEPS: Step[] = [
  { icon: Swatches, title: "You pick a design", detail: "We draw three designs for a business whose website is out of date. Pick the one to build, or ask for new ones.", yours: true },
  { icon: Hammer, title: "We build the site", detail: "The whole site is built from your pick and your notes.", yours: false },
  { icon: Eye, title: "You check it", detail: "Approve the built site, or point at what to fix first.", yours: true },
  { icon: Handshake, title: "The owner signs up", detail: "We email the owner their new site. If they sign up, you earn one month of their fee.", yours: false },
];

/**
 * What Defect does and where a designer fits, as the four steps from designs to a paying client. The designer's own
 * steps are drawn in ink. Open for a designer who hasn't decided on anything yet, folded away after that.
 */
export default function HowItWorks({ open }: { open: boolean }) {
  return (
    <details open={open} className="group/how flex flex-col">
      <summary className="text-ink-soft hover:text-ink flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
        <CaretRight size={16} weight="bold" className="ease-knife transition-transform duration-150 group-open/how:rotate-90" aria-hidden="true" />
        How this works
      </summary>
      <div className="flex flex-col gap-5 pt-3">
        <p className="max-w-prose text-lg text-pretty">Defect rebuilds outdated websites for small businesses and keeps them up to date for a monthly fee. You choose how each new site looks.</p>
        <ol className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.title} className={`flex flex-col gap-1.5 border-t-2 pt-3 ${step.yours ? "border-ink" : "border-ink/12"}`}>
              <span className="flex items-center gap-2 font-semibold">
                <step.icon size={20} className={step.yours ? "text-ink" : "text-ink-faint"} aria-hidden="true" />
                {step.title}
              </span>
              <span className="text-ink-soft text-sm text-pretty">{step.detail}</span>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}
