"use client";

import { ArrowCounterClockwise, CheckCircle, PaperPlaneTilt, PencilSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sendFromQueue, skipFromQueue, undoSkip } from "@/app/admin/(panel)/outreachActions";
import { asClause, type TemplateValues } from "@/lib/emailTemplate";
import type { Business } from "@/server/db/schema";
import { Button } from "../Button";
import Letter from "./Letter";
import PreviewThumb from "./PreviewThumb";
import { ArmChip, Card, Notice } from "./ui";

type QueueCardProps = {
  business: Business;
  kind: "first" | "follow_up";
  subject: string;
  template: string;
  values: TemplateValues;
  blockers: string[];
  limitReached: boolean;
};

type Outcome = { state: "idle" } | { state: "sent"; to: string } | { state: "skipped" } | { state: "error"; message: string };

const REFRESH_AFTER_MS = 1600;

function ProblemEditor({ value, onChange, onDone }: { value: string; onChange: (v: string) => void; onDone: () => void }) {
  return (
    <input
      autoFocus
      aria-label="Problem line"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={onDone}
      onKeyDown={(event) => event.key === "Enter" && onDone()}
      className="bg-surface border-ink/30 my-0.5 w-full rounded-md border px-2 py-1 focus-visible:outline-2 focus-visible:outline-ink/20"
    />
  );
}

/** The text stays an inline mark so it wraps with the sentence; a button can't break across lines. */
function ProblemMark({ text, onEdit }: { text: string; onEdit: () => void }) {
  return (
    <>
      <mark className="bg-paper-shade text-ink rounded px-0.5">{text}</mark>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit the problem line"
        title="Edit the problem line"
        className="text-ink-faint hover:bg-paper-shade hover:text-ink mx-0.5 inline-grid size-7 place-items-center rounded-md align-middle focus-visible:outline-2 focus-visible:outline-ink"
      >
        <PencilSimple size={16} aria-hidden="true" />
      </button>
    </>
  );
}

function SentRow({ name, to }: { name: string; to: string }) {
  return (
    <Card className="flex items-center gap-3 px-5 py-4">
      <CheckCircle size={24} weight="fill" className="text-good shrink-0" aria-hidden="true" />
      <p role="status">
        Sent to {name} at <span className="font-medium">{to}</span>
      </p>
    </Card>
  );
}

function SkippedRow({ name, onUndo, pending }: { name: string; onUndo: () => void; pending: boolean }) {
  return (
    <Card className="flex items-center justify-between gap-3 px-5 py-3">
      <p role="status" className="text-ink-soft">
        Skipped {name}. It&apos;s marked lost in the pipeline.
      </p>
      <Button size="sm" variant="ghost" onClick={onUndo} disabled={pending} icon={<ArrowCounterClockwise size={16} aria-hidden="true" />}>
        Undo
      </Button>
    </Card>
  );
}

function Header({ business, kind }: { business: Business; kind: QueueCardProps["kind"] }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 className="text-xl font-semibold">
        <Link href={`/admin/pipeline/${business.id}`} className="hover:underline focus-visible:outline-2 focus-visible:outline-ink">
          {business.businessName}
        </Link>
      </h3>
      <div className="flex items-center gap-3">
        {kind === "follow_up" && <span className="bg-ink/8 rounded-full px-2.5 py-0.5 text-sm font-medium">Follow-up</span>}
        <ArmChip arm={business.priceArm} />
      </div>
      <p className="text-ink-faint w-full text-sm">To {business.email || "no address yet"}</p>
    </div>
  );
}

function useProblemLine(business: Business) {
  const original = business.emailProblem || business.problemSummary;
  const [problem, setProblem] = useState(original);
  const [editing, setEditing] = useState(false);
  return { problem, setProblem, editing, setEditing, edited: problem !== original };
}

type ProblemLine = ReturnType<typeof useProblemLine>;

function EditableLetter({ subject, template, values, line }: { subject: string; template: string; values: TemplateValues; line: ProblemLine }) {
  const showProblem = (text: string) =>
    line.editing ? (
      <ProblemEditor value={line.problem} onChange={line.setProblem} onDone={() => line.setEditing(false)} />
    ) : (
      <ProblemMark text={text} onEdit={() => line.setEditing(true)} />
    );
  return (
    <Letter
      subject={subject}
      template={template}
      values={{ ...values, problem: asClause(line.problem) }}
      renderValue={(segment) => (segment.placeholder === "problem" ? showProblem(segment.text) : undefined)}
    />
  );
}

type ActionsProps = { blockers: string[]; error: string; cannotSend: boolean; pending: boolean; onSend: () => void; onSkip: () => void };

function QueueActions({ blockers, error, cannotSend, pending, onSend, onSkip }: ActionsProps) {
  return (
    <>
      {blockers.length > 0 && (
        <Notice tone="warn">
          <ul className="flex flex-col gap-1">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </Notice>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="solid" onClick={onSend} disabled={cannotSend || pending} aria-busy={pending} icon={<PaperPlaneTilt size={18} weight="bold" aria-hidden="true" />}>
          {pending ? "Sending" : "Send"}
        </Button>
        <Button variant="ghost" onClick={onSkip} disabled={pending}>
          Skip
        </Button>
      </div>
    </>
  );
}

export default function QueueCard({ business, kind, subject, template, values, blockers, limitReached }: QueueCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<Outcome>({ state: "idle" });
  const line = useProblemLine(business);

  const send = () =>
    startTransition(async () => {
      const result = await sendFromQueue(kind, business.id, line.edited ? line.problem : undefined);
      setOutcome(result.ok ? { state: "sent", to: result.to } : { state: "error", message: result.error });
      if (result.ok) setTimeout(() => router.refresh(), REFRESH_AFTER_MS);
    });

  const skip = () =>
    startTransition(async () => {
      if (!(await skipFromQueue(business.id)).ok) return;
      setOutcome({ state: "skipped" });
      router.refresh();
    });

  const undo = () =>
    startTransition(async () => {
      await undoSkip(business.id);
      setOutcome({ state: "idle" });
    });

  if (outcome.state === "sent") return <SentRow name={business.businessName} to={outcome.to} />;
  if (outcome.state === "skipped") return <SkippedRow name={business.businessName} onUndo={undo} pending={pending} />;

  return (
    <Card className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <Header business={business} kind={kind} />
        <EditableLetter subject={subject} template={template} values={values} line={line} />
        <QueueActions
          blockers={blockers}
          error={outcome.state === "error" ? outcome.message : ""}
          cannotSend={blockers.length > 0 || limitReached}
          pending={pending}
          onSend={send}
          onSkip={skip}
        />
      </div>
      <PreviewThumb url={business.previewUrl} name={business.businessName} />
    </Card>
  );
}
