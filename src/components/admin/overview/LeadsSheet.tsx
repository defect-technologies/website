import { ArrowDownLeft, ArrowUpRight, ChatCircleDots, Eye, Globe, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { actorLabel } from "@/lib/bots";
import { stepParts } from "@/lib/buildStatus";
import { LEAD_STATUS_LABEL, LEAD_STATUSES, type LeadStatus } from "@/lib/leadStatus";
import { JOB_STATUS_LABEL } from "@/lib/previewJobs";
import { senderName } from "@/lib/senders";
import { STAGE_LABEL } from "@/lib/stages";
import type { LastEmail, LeadRow } from "@/server/overview";
import { Cell, EmptyRow, GroupRow, RowHeader, Sheet, SheetBody, SheetRow } from "../sheet";
import { StepBar } from "../BuildProgress";
import OpenEditorButton from "../OpenEditorButton";
import { ArmChip, StatusMark, When } from "../ui";
import LeadStatusMark from "./LeadStatusMark";

const COLUMNS = ["Business", "Now", "Price", "Last email", "Open"];

/** Groups that tend to grow too long to scan, or have nothing left to do. Past a few rows they open on their own filter. */
const FOLDABLE: LeadStatus[] = ["not_queued", "closed"];
const FOLD_AFTER = 5;

export type Editors = Map<string, string>;

const linkClass = "text-ink-soft hover:text-ink inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-sm font-medium hover:bg-paper-shade whitespace-nowrap";

/** The preview, the live site and its editor, as one-click links. */
function OpenLinks({ lead, editorSlug }: { lead: LeadRow["lead"]; editorSlug: string | undefined }) {
  return (
    <span className="-mx-2 flex flex-wrap items-center">
      {lead.previewUrl && (
        <a href={lead.previewUrl} target="_blank" rel="noreferrer" className={linkClass}>
          <Eye size={16} aria-hidden="true" /> Preview<span className="sr-only"> of {lead.businessName} (opens in a new tab)</span>
        </a>
      )}
      {lead.siteUrl && lead.stage === "live" && (
        <a href={lead.siteUrl} target="_blank" rel="noreferrer" className={linkClass}>
          <Globe size={16} aria-hidden="true" /> Site<span className="sr-only"> of {lead.businessName} (opens in a new tab)</span>
        </a>
      )}
      {editorSlug && <OpenEditorButton slug={editorSlug} label="Editor" variant="ghost" size="sm" />}
    </span>
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

function StepWords({ step }: { step: string }) {
  const { done, total, words } = stepParts(step);
  return (
    <span>
      {done > 0 && <span className="font-semibold tabular-nums">{done}/{total} </span>}
      {words}
    </span>
  );
}

const ABANDONED_DETAIL = "The runner moved on without finishing this build. Put it back in the queue on Builds.";

function Building({ job, ctx }: TimedRow) {
  if (!job) return <>Starting up</>;
  const abandoned = ctx.abandoned.has(job.id);
  return (
    <span className="flex flex-col gap-1.5" title={`${job.step || "Starting up"} on ${job.runnerName || "the runner"}`}>
      {!abandoned && <StepBar step={job.step} size="sm" />}
      <span className="flex flex-wrap items-center gap-x-3">
        {abandoned ? <StatusMark icon={WarningCircle} tone="warn" label="Abandoned" detail={ABANDONED_DETAIL} /> : <StepWords step={job.step} />}
        <span className="text-ink-faint">
          <When date={job.startedAt ?? job.claimedAt} />
        </span>
      </span>
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

export type SheetContext = { editors: Editors; abandoned: Set<string> };

type TimedRow = LeadRow & { ctx: SheetContext };

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
  needs_a_look: ({ job }) => <Clipped text={job?.criticVerdict || "The design critic asked for changes"} />,
  ready_to_send: ({ lead }) => (
    <>
      Built <When date={lead.previewBuiltAt} />
    </>
  ),
  waiting: Waiting,
  negotiating: Negotiating,
  setting_up: ({ lead }) => (
    <>
      Paid <When date={lead.paidAt} />
      {lead.plan && `, ${lead.plan}`}
    </>
  ),
  live: ({ lead }) => (
    <>
      Live <When date={lead.launchedAt} />
      {lead.plan && `, ${lead.plan}`}
    </>
  ),
  closed: ({ lead }) => <Clipped text={lead.note ? `${STAGE_LABEL[lead.stage]}: ${lead.note}` : STAGE_LABEL[lead.stage]}>{STAGE_LABEL[lead.stage]}</Clipped>,
};

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

function LeadLine({ row, ctx }: { row: LeadRow; ctx: SheetContext }) {
  const Now = NOW[row.status];
  return (
    <SheetRow dim={row.status === "closed"}>
      <RowHeader className="lg:min-w-48">
        <Link href={`/admin/sites/${row.lead.id}`} className="hover:underline focus-visible:outline-2 focus-visible:outline-ink">
          {row.lead.businessName}
        </Link>
      </RowHeader>
      <Cell className="lg:min-w-72">
        <Now {...row} ctx={ctx} />
      </Cell>
      <Cell label="Price">
        <ArmChip arm={row.lead.priceArm} />
      </Cell>
      <Cell label="Last email">
        <LastEmailCell email={row.lastEmail} />
      </Cell>
      <Cell label="Open">
        <OpenLinks lead={row.lead} editorSlug={ctx.editors.get(row.lead.id)} />
      </Cell>
    </SheetRow>
  );
}

function Group({ status, rows, folded, href, ctx }: { status: LeadStatus; rows: LeadRow[]; folded: boolean; href: string; ctx: SheetContext }) {
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
      {!folded && rows.map((row) => <LeadLine key={row.lead.id} row={row} ctx={ctx} />)}
    </SheetBody>
  );
}

export function statusHref(status: LeadStatus | null, query = "") {
  const params = new URLSearchParams(Object.entries({ status: status ?? "", q: query }).filter(([, value]) => value));
  return params.size ? `/admin/sites?${params}` : "/admin/sites";
}

function StatusFilter({ counts, selected, query }: { counts: Map<LeadStatus, number>; selected: LeadStatus | null; query: string }) {
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const options: (LeadStatus | null)[] = [null, ...LEAD_STATUSES.filter((status) => counts.get(status))];
  return (
    <nav aria-label="Filter sites by status">
      <ul className="flex flex-wrap gap-1">
        {options.map((status) => {
          const current = status === selected;
          return (
            <li key={status ?? "all"}>
              <Link
                href={statusHref(status, query)}
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

/** Every business, lead or client, grouped by where it is in the order businesses move. */
export default function LeadsSheet({ rows, selected, ctx, query = "" }: { rows: LeadRow[]; selected: LeadStatus | null; ctx: SheetContext; query?: string }) {
  const shown = selected ? [selected] : LEAD_STATUSES;
  return (
    <div className="flex flex-col gap-3">
      <StatusFilter counts={countByStatus(rows)} selected={selected} query={query} />
      <Sheet caption="Sites" columns={COLUMNS}>
        {rows.length === 0 ? (
          <SheetBody>
            <EmptyRow span={COLUMNS.length}>{query ? `Nothing matches “${query}”` : "No sites yet"}</EmptyRow>
          </SheetBody>
        ) : (
          shown.map((status) => {
            const group = rows.filter((row) => row.status === status);
            const folded = !selected && FOLDABLE.includes(status) && group.length > FOLD_AFTER;
            return <Group key={status} status={status} rows={group} folded={folded} href={statusHref(status, query)} ctx={ctx} />;
          })
        )}
      </Sheet>
    </div>
  );
}
