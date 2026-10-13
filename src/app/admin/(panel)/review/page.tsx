import { ArrowClockwise, ArrowSquareOut, Check, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/Button";
import EmptyState from "@/components/admin/EmptyState";
import { TextAreaField } from "@/components/admin/fields";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, PageHeader, SectionHeading, When } from "@/components/admin/ui";
import { FIXER_LABEL, type Fixer } from "@/lib/flags";
import type { Flag } from "@/server/db/schema";
import { openFlags, resolvedFlags, type FlagRow } from "@/server/bots/flags";
import { approvePreviewAction, requestPreviewAction } from "../pipeline/actions";
import { handToClaudeAction, resolveFlagAction } from "./actions";

export const metadata: Metadata = { title: "Review queue" };

const STATUS_LABEL: Record<string, string> = { answered: "Answered", approved: "Approved", reversed: "Reversed", fixed: "Fixed", closed: "Closed" };

/** Flags from before the rebuild have no headline; their first sentence stands in. */
const headlineOf = (flag: Flag) => flag.headline || flag.whatHappened.split(/(?<=\.)\s|\n/)[0];

function Intent({ flag, intent, value, variant = "soft", icon, children }: { flag: Flag; intent: string; value?: string; variant?: "solid" | "soft" | "ghost"; icon?: ReactNode; children: ReactNode }) {
  return (
    <form action={resolveFlagAction}>
      <input type="hidden" name="id" value={flag.id} />
      <input type="hidden" name="intent" value={intent} />
      {value !== undefined && <input type="hidden" name="answer" value={value} />}
      <SubmitButton variant={variant} size="sm" icon={icon}>
        {children}
      </SubmitButton>
    </form>
  );
}

function WriteAnswer({ flag }: { flag: Flag }) {
  return (
    <details className="group/answer open:w-full">
      <summary className="text-ink-soft hover:text-ink inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <PencilSimple size={16} aria-hidden="true" />
        Write an answer
      </summary>
      <form action={resolveFlagAction} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="id" value={flag.id} />
        <input type="hidden" name="intent" value="answer" />
        <TextAreaField label="Your answer" name="answer" id={`answer-${flag.id}`} required hint="The bot reads this on its next run and acts on it." />
        <SubmitButton variant="solid" size="sm" className="self-start">
          Send answer
        </SubmitButton>
      </form>
    </details>
  );
}

/** The design critic held a preview: these act on the lead directly, since no bot reads the answer. */
function PreviewReviewActions({ flag }: { flag: Flag }) {
  return (
    <>
      <form action={approvePreviewAction}>
        <input type="hidden" name="id" value={flag.businessId ?? ""} />
        <SubmitButton variant="solid" size="sm" icon={<Check size={16} weight="bold" aria-hidden="true" />}>
          Ready to send
        </SubmitButton>
      </form>
      {flag.link && (
        <a href={flag.link} target="_blank" rel="noreferrer" className={buttonClasses("soft", "sm")}>
          Open the preview
          <ArrowSquareOut size={16} aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
      <details className="open:w-full">
        <summary className="text-ink-soft hover:text-ink inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <PencilSimple size={16} aria-hidden="true" />
          Rebuild with a note
        </summary>
        <form action={requestPreviewAction} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="id" value={flag.businessId ?? ""} />
          <TextAreaField label="What should change" name="note" id={`note-${flag.id}`} rows={3} required maxLength={2000} />
          <SubmitButton variant="solid" size="sm" className="self-start" icon={<ArrowClockwise size={16} aria-hidden="true" />}>
            Rebuild with this note
          </SubmitButton>
        </form>
      </details>
    </>
  );
}

function DecisionActions({ flag }: { flag: Flag }) {
  if (flag.topic === "preview-review" && flag.bot === "runner") return <PreviewReviewActions flag={flag} />;
  return (
    <>
      {flag.options.map((option, index) => (
        <Intent key={option} flag={flag} intent="answer" value={option} variant={index === 0 ? "solid" : "soft"}>
          {option}
        </Intent>
      ))}
      <WriteAnswer flag={flag} />
    </>
  );
}

const RETRY_LABEL: Record<string, string> = { launch: "Retry launch", build: "Rebuild preview" };

/** Claude works its flags by itself: this says whether it has started, or hands it a founder's flag. */
function ClaudeStatus({ flag }: { flag: Flag }) {
  if (flag.fixer !== "claude") {
    return (
      <form action={handToClaudeAction}>
        <input type="hidden" name="id" value={flag.id} />
        <SubmitButton variant="soft" size="sm">
          Hand to Claude
        </SubmitButton>
      </form>
    );
  }
  const started = flag.reviewer === "claude" ? /\d{4}-\d{2}-\d{2}T[\d:.]+Z/.exec(flag.note)?.[0] : undefined;
  return (
    <span className="text-ink-soft inline-flex min-h-9 items-center text-sm">
      {started ? (
        <>
          Claude is working on this, since&nbsp;<When date={new Date(started)} />
        </>
      ) : (
        "Claude picks this up within a few minutes"
      )}
    </span>
  );
}

function FixActions({ row }: { row: FlagRow }) {
  const { flag } = row;
  const retry = flag.businessId ? RETRY_LABEL[flag.topic] : undefined;
  return (
    <>
      <ClaudeStatus flag={flag} />
      {retry && (
        <Intent flag={flag} intent="retry" variant={flag.fixer === "claude" ? "soft" : "solid"} icon={<ArrowClockwise size={16} aria-hidden="true" />}>
          {retry}
        </Intent>
      )}
      <Intent flag={flag} intent="fixed" icon={<Check size={16} weight="bold" aria-hidden="true" />}>
        It&apos;s fixed
      </Intent>
    </>
  );
}

function Details({ flag }: { flag: Flag }) {
  if (!flag.details && !flag.link) return null;
  return (
    <details className="group/details">
      <summary className="text-ink-faint hover:text-ink w-fit cursor-pointer text-sm">
        Details{flag.reports > 1 ? `, ${flag.reports} reports` : ""}
      </summary>
      <div className="bg-paper-shade/60 mt-2 flex flex-col gap-3 rounded-xl p-3.5 text-sm">
        {flag.details && <p className="text-ink-soft break-words whitespace-pre-wrap">{flag.details}</p>}
        {flag.link && (
          <a href={flag.link} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 font-medium hover:underline">
            Open the email thread
            <ArrowSquareOut size={14} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
    </details>
  );
}

function CardMeta({ row }: { row: FlagRow }) {
  const { flag, businessName } = row;
  return (
    <div className="text-ink-faint flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {flag.priority === "urgent" && <span className="bg-bad text-paper rounded-full px-2.5 py-0.5 font-medium">Urgent</span>}
      {flag.needs === "fix" && <span className="text-ink font-medium">{FIXER_LABEL[flag.fixer as Fixer]}</span>}
      {flag.businessId && (
        <Link href={`/admin/pipeline/${flag.businessId}`} className="hover:text-ink hover:underline">
          {businessName ?? "Lead"}
        </Link>
      )}
      <When date={flag.updatedAt} />
    </div>
  );
}

function FlagCard({ row }: { row: FlagRow }) {
  const { flag } = row;
  return (
    <Card id={`flag-${flag.id}`} className="flex scroll-mt-6 flex-col gap-4 p-5">
      <CardMeta row={row} />
      <div className="flex flex-col gap-1.5">
        <h3 className="text-xl leading-snug font-semibold text-pretty">{headlineOf(flag)}</h3>
        {flag.ask && <p className="text-ink-soft max-w-prose text-pretty">{flag.ask}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {flag.needs === "decision" ? <DecisionActions flag={flag} /> : <FixActions row={row} />}
        <Intent flag={flag} intent="dismiss" variant="ghost">
          Dismiss
        </Intent>
      </div>
      <Details flag={flag} />
    </Card>
  );
}

function Group({ title, rows }: { title: string; rows: FlagRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading count={rows.length}>{title}</SectionHeading>
      {rows.map((row) => (
        <FlagCard key={row.flag.id} row={row} />
      ))}
    </section>
  );
}

function Resolved({ rows }: { rows: FlagRow[] }) {
  if (rows.length === 0) return null;
  return (
    <details className="group/resolved">
      <summary className="text-ink-soft hover:text-ink w-fit cursor-pointer text-sm">Recently resolved ({rows.length})</summary>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map(({ flag, businessName }) => (
          <li key={flag.id} className="flex flex-wrap gap-x-3 text-sm">
            <span className="w-16 shrink-0 font-medium">{STATUS_LABEL[flag.status]}</span>
            <span className="min-w-0 flex-1 text-pretty">{headlineOf(flag)}</span>
            <span className="text-ink-faint">{businessName ?? ""}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default async function ReviewPage() {
  const [open, resolved] = await Promise.all([openFlags(), resolvedFlags()]);
  return (
    <>
      <PageHeader title="Review queue" />
      {open.length === 0 && <EmptyState title="Nothing needs you">When a bot needs a decision or something breaks, it shows up here and in your email.</EmptyState>}
      <Group title="Needs your decision" rows={open.filter((row) => row.flag.needs === "decision")} />
      <Group title="Needs a fix" rows={open.filter((row) => row.flag.needs === "fix")} />
      <Resolved rows={resolved} />
    </>
  );
}
