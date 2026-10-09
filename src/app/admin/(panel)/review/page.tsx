import { ArrowCounterClockwise, ArrowSquareOut, ChatText, Check } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/admin/EmptyState";
import { TextAreaField } from "@/components/admin/fields";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, KeyValue, PageHeader, SectionHeading, When } from "@/components/admin/ui";
import { BOT_LABEL, FLAG_PRIORITIES, type Bot, type FlagPriority } from "@/lib/bots";
import type { Flag } from "@/server/db/schema";
import { openFlags, resolvedFlags } from "@/server/bots/flags";
import { resolveFlagAction } from "./actions";

export const metadata: Metadata = { title: "Review queue" };

type Row = { flag: Flag; businessName: string | null };

const PRIORITY_HEADING: Record<FlagPriority, string> = { urgent: "Urgent", review: "To review", fyi: "For your information" };
const PRIORITY_TONE: Record<string, string> = { urgent: "bg-bad text-paper", review: "bg-warn/15 text-warn", fyi: "bg-paper-shade text-ink-soft" };
const STATUS_LABEL: Record<string, string> = { answered: "Answered", approved: "Approved", reversed: "Reversed" };

function Client({ flag, businessName }: Row) {
  if (!flag.businessId) return <span className="text-ink-faint">No lead</span>;
  return (
    <Link href={`/admin/pipeline/${flag.businessId}`} className="hover:underline">
      {businessName ?? "Lead"}
    </Link>
  );
}

function ThreadLink({ url }: { url: string }) {
  if (!url) return <span className="text-ink-faint">None</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all hover:underline">
      Open
      <ArrowSquareOut size={14} aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function FlagFacts({ row }: { row: Row }) {
  const { flag } = row;
  return (
    <KeyValue
      rows={[
        ["What happened", flag.whatHappened],
        ["What the bot did", flag.whatBotDid],
        ["Why it flagged", flag.why],
        ["Client", <Client key="client" {...row} />],
        ["Link", <ThreadLink key="link" url={flag.link} />],
      ]}
    />
  );
}

function ResolveForm({ flag }: { flag: Flag }) {
  return (
    <form action={resolveFlagAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={flag.id} />
      <TextAreaField label="Answer for the bot" name="note" id={`note-${flag.id}`} hint="The bot reads this on its next run and acts on it. Needed for Send answer." />
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="solid" name="status" value="answered" icon={<ChatText size={18} aria-hidden="true" />}>
          Send answer
        </SubmitButton>
        <SubmitButton name="status" value="approved" icon={<Check size={18} aria-hidden="true" />}>
          Approve what it did
        </SubmitButton>
        <SubmitButton variant="ghost" name="status" value="reversed" icon={<ArrowCounterClockwise size={18} aria-hidden="true" />}>
          Mark reversed
        </SubmitButton>
      </div>
    </form>
  );
}

function FlagCard({ row }: { row: Row }) {
  const { flag } = row;
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className={`rounded-full px-2.5 py-0.5 font-medium ${PRIORITY_TONE[flag.priority] ?? PRIORITY_TONE.fyi}`}>{PRIORITY_HEADING[flag.priority as FlagPriority] ?? flag.priority}</span>
        <span className="font-medium">{BOT_LABEL[flag.bot as Bot]} bot</span>
        <span className="text-ink-faint">
          <When date={flag.at} />
        </span>
      </div>
      <FlagFacts row={row} />
      <ResolveForm flag={flag} />
    </Card>
  );
}

function PriorityGroup({ priority, rows }: { priority: FlagPriority; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading count={rows.length}>{PRIORITY_HEADING[priority]}</SectionHeading>
      {rows.map((row) => (
        <FlagCard key={row.flag.id} row={row} />
      ))}
    </section>
  );
}

function Resolved({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <details className="group/resolved">
      <summary className="text-ink-soft hover:text-ink w-fit cursor-pointer text-sm">Recently resolved ({rows.length})</summary>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map(({ flag, businessName }) => (
          <li key={flag.id} className="flex flex-wrap gap-x-3 text-sm">
            <span className="font-medium">{STATUS_LABEL[flag.status]}</span>
            <span className="min-w-0 flex-1 text-pretty">{flag.whatHappened}</span>
            <span className="text-ink-faint">{businessName ?? ""}</span>
            <span className="text-ink-faint">by {flag.reviewer}</span>
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
      {open.length === 0 && <EmptyState title="Nothing to review">When a bot isn&apos;t sure, or a rule says a founder decides, the flag shows up here.</EmptyState>}
      {FLAG_PRIORITIES.map((priority) => (
        <PriorityGroup key={priority} priority={priority} rows={open.filter((row) => row.flag.priority === priority)} />
      ))}
      <Resolved rows={resolved} />
    </>
  );
}
