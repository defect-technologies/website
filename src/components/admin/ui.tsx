import type { Icon } from "@phosphor-icons/react";
import { CheckCircle, Info, Warning, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { HTMLAttributes, ReactNode } from "react";
import { STAGE_LABEL } from "@/lib/stages";
import type { Stage } from "@/server/db/schema";

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`bg-surface shadow-card rounded-2xl ${className}`} {...rest} />;
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="font-display text-5xl leading-none font-black">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </header>
  );
}

/** One kind of work on a page: a heading with its count, an optional action at the right, and the items. */
export function Section({ id, title, count, action, children }: { id?: string; title: string; count?: number; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-label={title} className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading count={count}>{title}</SectionHeading>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SectionHeading({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <h2 className="flex items-baseline gap-2 text-lg font-semibold">
      {children}
      {count !== undefined && <span className="text-ink-faint font-normal tabular-nums">{count}</span>}
    </h2>
  );
}

const STAGE_TONE: Record<Stage, string> = {
  new: "bg-paper-shade text-ink-soft",
  preview_built: "bg-paper-shade text-ink",
  sent: "bg-ink/8 text-ink",
  clicked: "bg-ink/8 text-ink",
  replied: "bg-ink text-paper",
  paid: "bg-good text-paper",
  live: "bg-good text-paper",
  lost: "bg-paper-shade text-ink-faint line-through",
  opted_out: "bg-bad/10 text-bad",
};

export function StageChip({ stage }: { stage: Stage }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium ${STAGE_TONE[stage]}`}>{STAGE_LABEL[stage]}</span>;
}

const ARM_DOT: Record<number, string> = { 59: "bg-arm-59", 79: "bg-arm-79" };

export function ArmChip({ arm }: { arm: number | null }) {
  if (!arm) return <span className="text-ink-faint text-sm">No price</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium tabular-nums">
      <span aria-hidden="true" className={`size-2.5 rounded-full ${ARM_DOT[arm] ?? "bg-ink"}`} />${arm}
    </span>
  );
}

type Tone = "good" | "warn" | "bad";

const NOTICE: Record<Tone, { icon: ReactNode; className: string }> = {
  good: { icon: <CheckCircle size={20} weight="fill" aria-hidden="true" />, className: "bg-good/10 text-good" },
  warn: { icon: <Warning size={20} weight="fill" aria-hidden="true" />, className: "bg-warn/10 text-warn" },
  bad: { icon: <WarningCircle size={20} weight="fill" aria-hidden="true" />, className: "bg-bad/10 text-bad" },
};

export function Notice({ tone, children, className = "" }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm ${NOTICE[tone].className} ${className}`}>
      <span className="mt-px shrink-0">{NOTICE[tone].icon}</span>
      <div className="min-w-0 text-pretty">{children}</div>
    </div>
  );
}

export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
      {rows.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-ink-faint">{key}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

export function timeAgo(date: Date | null, now = Date.now()): string {
  if (!date) return "never";
  const seconds = Math.round((date.getTime() - now) / 1000);
  const [unit, size] = STEPS.find(([, size]) => Math.abs(seconds) >= size) ?? ["second", 1];
  return relative.format(Math.round(seconds / size), unit);
}

const fullDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export function When({ date }: { date: Date | null }) {
  if (!date) return <span className="text-ink-faint">never</span>;
  return (
    <time dateTime={date.toISOString()} title={fullDate.format(date)}>
      {timeAgo(date)}
    </time>
  );
}

export type StatusTone = "good" | "warn" | "bad" | "quiet" | "ink";

const STATUS_TONE: Record<StatusTone, string> = { good: "text-good", warn: "text-warn", bad: "text-bad", quiet: "text-ink-faint", ink: "text-ink" };

/** A state as an icon and a word or two. The sentence behind it is in the tooltip and read to screen readers. */
export function StatusMark({ icon: MarkIcon, tone = "quiet", label, detail }: { icon: Icon; tone?: StatusTone; label: ReactNode; detail?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap ${STATUS_TONE[tone]}`} title={detail}>
      <MarkIcon size={16} weight="fill" aria-hidden="true" className="shrink-0" />
      {label}
      {detail && <span className="sr-only">: {detail}</span>}
    </span>
  );
}

/** Help a founder only needs once: an info mark that shows the text on hover or keyboard focus. */
export function InfoTip({ children, className = "" }: { children: string; className?: string }) {
  return (
    <span className={`group/tip relative inline-flex align-middle ${className}`}>
      <span tabIndex={0} className="text-ink-faint hover:text-ink focus-visible:outline-ink inline-flex size-6 items-center justify-center rounded-full focus-visible:outline-2">
        <Info size={16} aria-hidden="true" />
        <span className="sr-only">{children}</span>
      </span>
      <span
        aria-hidden="true"
        className="bg-ink text-paper pointer-events-none invisible absolute bottom-full left-1/2 z-20 mb-1.5 w-max max-w-64 -translate-x-1/2 rounded-lg px-2.5 py-1.5 text-sm font-normal text-pretty opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}
