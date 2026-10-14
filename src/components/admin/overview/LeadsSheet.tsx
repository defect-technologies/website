import { ArrowDownLeft, ArrowSquareOut, ArrowUpRight, ChatCircleDots, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { actorLabel, BOT_LABEL, type Bot } from "@/lib/bots";
import { LEAD_STATUS_LABEL, LEAD_STATUS_OWNER, LEAD_STATUSES, type LeadStatus, type Owner } from "@/lib/leadStatus";
import { JOB_STATUS_LABEL } from "@/lib/previewJobs";
import { senderName } from "@/lib/senders";
import { STAGE_LABEL } from "@/lib/stages";
import type { LastEmail, LeadRow } from "@/server/overview";
import { Cell, EmptyRow, GroupRow, RowHeader, Sheet, SheetBody, SheetRow } from "../sheet";
import { StatusMark, When } from "../ui";
import LeadStatusMark from "./LeadStatusMark";

const COLUMNS = ["Business", "Now", "With", "Last email"];

/** Groups that tend to grow too long to scan, or have nothing left to do. Past a few rows they open on their own filter. */
const FOLDABLE: LeadStatus[] = ["not_queued", "closed"];
const FOLD_AFTER = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

function OpenPreview({ url }: { url: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-ink-soft inline-flex items-center gap-1 hover:underline">
      Preview <ArrowSquareOut size={14} aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** A long sentence from a bot or the critic, cut to one line. The whole of it is in the tooltip. */
function Clipped({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <span className="text-ink-soft line-clamp-1" title={text}>
      {children ?? text}
    </span>
  );
}

/** "4/6 Designing and building with Claude (this takes a while)" reads as "4/6 Designing and building with Claude". */
function stepParts(step: string) {
  const match = /^(\d+\/\d+)\s+(.*)$/.exec(step);
  const words = (match?.[2] ?? step).replace(/\s*\([^)]*\)\s*$/, "");
  return { fraction: match?.[1] ?? "", words: words || "Starting up" };
}

function Building({ job, now }: TimedRow) {
  const { fraction, words } = stepParts(job?.step ?? "");
  const started = job?.startedAt ?? job?.claimedAt ?? null;
  const stuck = started !== null && now - started.getTime() > DAY_MS;
  return (
    <span className="flex flex-wrap items-center gap-x-3" title={`${job?.step || "Starting up"} on ${job?.runnerName || "the runner"}`}>
      <span>
        {fraction && <span className="font-semibold tabular-nums">{fraction} </span>}
        {words}
      </span>
      {stuck ? (
        <StatusMark icon={WarningCircle} tone="warn" label={<>Started <When date={started} /></>} />
      ) : (
        <span className="text-ink-faint">
          <When date={started} />
        </span>
      )}
    </span>
  );
}

function Waiting({ lead }: LeadRow) {
  const opens = lead.clickCount === 0 ? "no opens" : `${lead.clickCount} ${lead.clickCount === 1 ? "open" : "opens"}`;
  return (
    <>
      {lead.followUpSentAt ? "Followed up" : "Emailed"} <When date={lead.followUpSentAt ?? lead.firstSentAt} />, {opens}
    </>
  );
}

function Negotiating({ lastEmail }: LeadRow) {
  if (!lastEmail) return <>Replied</>;
  if (lastEmail.direction === "in") return <StatusMark icon={ChatCircleDots} tone="ink" label="Their message is waiting" detail="They wrote last." />;
  return <span className="text-ink-soft">Waiting on them</span>;
}

/** "Their site scored 4/5: A modern…" reads as "Scored 4/5". */
function Skipped({ job }: LeadRow) {
  const verdict = job?.criticVerdict || "Their current site is already good";
  const score = /scored (\d\/5)/i.exec(verdict)?.[1];
  return <Clipped text={verdict}>{score ? `Their site scored ${score}` : verdict}</Clipped>;
}

type TimedRow = LeadRow & { now: number };

const NOW: Record<LeadStatus, (row: TimedRow) => ReactNode> = {
  not_queued: ({ lead }) => <Clipped text={lead.problemSummary || lead.niche || "No preview requested"} />,
  queued: ({ job }) =>
    job?.status === "waiting_for_usage" ? (
      JOB_STATUS_LABEL.waiting_for_usage
    ) : (
      <>
        {actorLabel(job?.requestedBy ?? "")} <When date={job?.createdAt ?? null} />
      </>
    ),
  building: Building,
  build_failed: ({ job }) => (
    <span className="flex flex-wrap gap-x-3">
      <Clipped text={job?.criticVerdict || "The build failed"} />
      <span className="text-ink-faint">
        <When date={job?.finishedAt ?? null} />
      </span>
    </span>
  ),
  skipped: Skipped,
  needs_a_look: ({ lead, job }) => (
    <span className="flex flex-wrap gap-x-3">
      <Clipped text={job?.criticVerdict || "The design critic asked for changes"} />
      <OpenPreview url={lead.previewUrl} />
    </span>
  ),
  ready_to_send: ({ lead }) => (
    <span className="flex flex-wrap gap-x-3">
      <span>
        Built <When date={lead.previewBuiltAt} />
      </span>
      <OpenPreview url={lead.previewUrl} />
    </span>
  ),
  waiting: Waiting,
  negotiating: Negotiating,
  setting_up: ({ lead }) => (
    <>
      Paid <When date={lead.paidAt} />
      {lead.plan && `, ${lead.plan}`}
    </>
  ),
  closed: ({ lead }) => <Clipped text={lead.note ? `${STAGE_LABEL[lead.stage]}: ${lead.note}` : STAGE_LABEL[lead.stage]}>{STAGE_LABEL[lead.stage]}</Clipped>,
};

const OWNER_LABEL: Record<Exclude<Owner, Bot>, string> = { founders: "Founders", nobody: "Nobody" };

function ownerName(owner: Owner) {
  return owner === "founders" || owner === "nobody" ? OWNER_LABEL[owner] : BOT_LABEL[owner];
}

export function LastEmailCell({ email }: { email: LastEmail | null }) {
  if (!email) return <span className="text-ink-faint">None</span>;
  const incoming = email.direction === "in";
  const Arrow = incoming ? ArrowDownLeft : ArrowUpRight;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Arrow size={14} weight="bold" className={incoming ? "text-ink" : "text-ink-faint"} aria-hidden="true" />
      <span>{incoming ? "Them" : senderName(email.sentBy)}</span>
      <span className="text-ink-faint">
        <When date={email.at} />
      </span>
    </span>
  );
}

function LeadLine({ row, now }: { row: LeadRow; now: number }) {
  const Now = NOW[row.status];
  return (
    <SheetRow dim={row.status === "closed"}>
      <RowHeader className="lg:min-w-48">
        <Link href={`/admin/leads/${row.lead.id}`} className="hover:underline focus-visible:outline-2 focus-visible:outline-ink">
          {row.lead.businessName}
        </Link>
      </RowHeader>
      <Cell className="lg:min-w-72">
        <Now {...row} now={now} />
      </Cell>
      <Cell label="With" className="whitespace-nowrap">
        {ownerName(LEAD_STATUS_OWNER[row.status])}
      </Cell>
      <Cell label="Last email">
        <LastEmailCell email={row.lastEmail} />
      </Cell>
    </SheetRow>
  );
}

function Group({ status, rows, folded, href, now }: { status: LeadStatus; rows: LeadRow[]; folded: boolean; href: string; now: number }) {
  if (rows.length === 0) return null;
  return (
    <SheetBody>
      <GroupRow span={COLUMNS.length}>
        <span className="font-semibold">
          <LeadStatusMark status={status} />
        </span>
        <span className="text-ink-faint tabular-nums">{rows.length}</span>
        {folded && (
          <Link href={href} className="text-ink-soft ms-auto underline underline-offset-4 hover:text-ink">
            Show all {rows.length}
          </Link>
        )}
      </GroupRow>
      {!folded && rows.map((row) => <LeadLine key={row.lead.id} row={row} now={now} />)}
    </SheetBody>
  );
}

export function statusHref(status: LeadStatus | null) {
  return status ? `/admin/leads?status=${status}` : "/admin/leads";
}

function StatusFilter({ counts, selected }: { counts: Map<LeadStatus, number>; selected: LeadStatus | null }) {
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const options: (LeadStatus | null)[] = [null, ...LEAD_STATUSES.filter((status) => counts.get(status))];
  return (
    <nav aria-label="Filter leads by status">
      <ul className="flex flex-wrap gap-1">
        {options.map((status) => {
          const current = status === selected;
          return (
            <li key={status ?? "all"}>
              <Link
                href={statusHref(status)}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ink ${current ? "bg-ink text-paper font-semibold" : "text-ink-soft hover:bg-paper-shade"}`}
              >
                {status ? LEAD_STATUS_LABEL[status] : "All"}
                <span className={`tabular-nums ${current ? "text-paper/70" : "text-ink-faint"}`}>{status ? counts.get(status) : total}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function countByStatus(rows: LeadRow[]) {
  const counts = new Map<LeadStatus, number>();
  for (const row of rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  return counts;
}

/** Every lead that isn't a client yet, grouped by where it is, in the order leads move. */
export default function LeadsSheet({ rows, selected, now }: { rows: LeadRow[]; selected: LeadStatus | null; now: number }) {
  const shown = selected ? [selected] : LEAD_STATUSES;
  return (
    <div className="flex flex-col gap-3">
      <StatusFilter counts={countByStatus(rows)} selected={selected} />
      <Sheet caption="Leads" columns={COLUMNS}>
        {rows.length === 0 ? (
          <SheetBody>
            <EmptyRow span={COLUMNS.length}>No leads yet</EmptyRow>
          </SheetBody>
        ) : (
          shown.map((status) => {
            const group = rows.filter((row) => row.status === status);
            const folded = !selected && FOLDABLE.includes(status) && group.length > FOLD_AFTER;
            return <Group key={status} status={status} rows={group} folded={folded} href={statusHref(status)} now={now} />;
          })
        )}
      </Sheet>
    </div>
  );
}
