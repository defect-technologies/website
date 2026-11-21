import { ArrowsClockwise, Check, Hammer, PaperPlaneTilt, PencilSimpleLine } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { Card, Section, StatusMark, When } from "@/components/admin/ui";
import type { BoardVerdict } from "@/lib/boards";
import type { BuildVerdict, DesignDecision } from "@/server/designers/oversight";

const VERDICT: Record<BoardVerdict, { icon: Icon; label: (decision: DesignDecision) => string }> = {
  chose: { icon: Hammer, label: (decision) => `Built ${decision.letter?.toUpperCase()}, ${decision.optionName}` },
  revise: { icon: PencilSimpleLine, label: (decision) => `Asked for ${decision.letter?.toUpperCase()}, ${decision.optionName}, revised` },
  redraw: { icon: ArrowsClockwise, label: () => "Asked for three new designs" },
};

/** Their words, as they wrote them, when they wrote any. */
function Words({ text }: { text: string }) {
  return text ? <p className="max-w-prose text-pretty whitespace-pre-line">{text}</p> : null;
}

/** Every design decision a designer made, with their words. */
export function DecisionList({ decisions }: { decisions: DesignDecision[] }) {
  if (!decisions.length) return null;
  return (
    <Section title="Design decisions" count={decisions.length}>
      <Card>
        <ul className="divide-ink/8 divide-y">
          {decisions.map((decision) => (
            <li key={decision.id} className="flex flex-col gap-1.5 px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Link href={`/admin/designs/${decision.id}`} className="focus-visible:outline-ink font-semibold hover:underline focus-visible:outline-2">
                  {decision.businessName}
                </Link>
                <span className="text-ink-faint text-sm">
                  <When date={decision.at} />
                </span>
              </div>
              <StatusMark icon={VERDICT[decision.verdict].icon} tone="ink" label={VERDICT[decision.verdict].label(decision)} />
              <Words text={decision.feedback} />
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}

/** Every built site a designer approved, or sent back with notes for the builder to repair. */
export function BuildVerdictList({ verdicts }: { verdicts: BuildVerdict[] }) {
  if (!verdicts.length) return null;
  return (
    <Section title="Build reviews" count={verdicts.length}>
      <Card>
        <ul className="divide-ink/8 divide-y">
          {verdicts.map((verdict) => (
            <li key={verdict.id} className="flex flex-col gap-1.5 px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <a href={verdict.previewUrl} target="_blank" rel="noreferrer" className="focus-visible:outline-ink font-semibold hover:underline focus-visible:outline-2">
                  {verdict.businessName}
                  <span className="sr-only"> preview (opens in a new tab)</span>
                </a>
                <span className="text-ink-faint text-sm">
                  <When date={verdict.at} />
                </span>
              </div>
              {verdict.verdict === "approved" ? (
                <StatusMark icon={Check} tone="good" label="Approved" />
              ) : (
                <>
                  <StatusMark icon={PaperPlaneTilt} tone="ink" label={`Sent back ${verdict.notes.length} ${verdict.notes.length === 1 ? "note" : "notes"}`} />
                  <ul className="flex list-disc flex-col gap-1 pl-5">
                    {verdict.notes.map((note) => (
                      <li key={note.id} className="max-w-prose text-pretty">
                        {note.text}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}
