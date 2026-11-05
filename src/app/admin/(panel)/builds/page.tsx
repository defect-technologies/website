import { ArrowCounterClockwise, CheckCircle, HourglassMedium, MinusCircle, Moon, Play, WarningCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { Metadata } from "next";
import Link from "next/link";
import BuildProgress, { clockTime, minutesText } from "@/components/admin/BuildProgress";
import LiveRefresh from "@/components/admin/overview/LiveRefresh";
import Pager, { pageFrom } from "@/components/admin/Pager";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, PageHeader, Section, StatusMark, When } from "@/components/admin/ui";
import { jobsByDay, requestSentence, stepParts } from "@/lib/buildStatus";
import { isSkipped, JOB_STATUS_LABEL } from "@/lib/previewJobs";
import { runnerDay } from "@/server/overview";
import { buildHistory, type BuildHistory } from "@/server/runner/history";
import { runnerStatus, type CurrentBuild, type JobRow, type QueuedBuild } from "@/server/runner/status";
import { resumeRunnerAction } from "../setup/bots/actions";
import { settleAbandonedJobAction } from "../sites/actions";

export const metadata: Metadata = { title: "Builds" };

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const finishedClock = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" });

function SiteLink({ job }: { job: JobRow }) {
  return (
    <Link href={`/admin/sites/${job.businessId}`} className="font-semibold hover:underline">
      {job.businessName}
    </Link>
  );
}

function Current({ job, now }: { job: CurrentBuild; now: number }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-xl">
          <SiteLink job={job} />
        </h3>
        <span className="text-ink-faint text-sm" title={job.note || undefined}>
          {requestSentence(job)}
        </span>
      </div>
      <BuildProgress step={job.step} eta={job.eta} now={now} />
    </Card>
  );
}

function Idle({ last }: { last: JobRow | undefined }) {
  return (
    <Card className="flex items-center gap-3 p-5">
      <Moon size={20} className="text-ink-faint" aria-hidden="true" />
      <span className="font-semibold">Idle</span>
      {last && (
        <span className="text-ink-faint text-sm">
          Last build finished <When date={last.finishedAt} />
        </span>
      )}
    </Card>
  );
}

function Queue({ jobs, now }: { jobs: QueuedBuild[]; now: number }) {
  if (jobs.length === 0) return null;
  return (
    <Section title="Queue" count={jobs.length}>
      <Card>
        <ol className="divide-ink/8 divide-y">
          {jobs.map((job, index) => (
            <li key={job.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-x-3 px-5 py-3">
              <span className="text-ink-faint tabular-nums">{index + 1}</span>
              <span className="min-w-0">
                <SiteLink job={job} />
                <span className="text-ink-faint ml-3 text-sm" title={job.note || undefined}>
                  {requestSentence(job)}
                </span>
              </span>
              <span className="text-ink-soft text-sm tabular-nums">starts ~{clockTime(job.startsAt, now)}</span>
            </li>
          ))}
        </ol>
      </Card>
    </Section>
  );
}

function SettleButton({ job, intent, icon, children }: { job: JobRow; intent: "requeue" | "fail"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <form action={settleAbandonedJobAction}>
      <input type="hidden" name="id" value={job.id} />
      <input type="hidden" name="intent" value={intent} />
      <SubmitButton size="sm" variant={intent === "requeue" ? "soft" : "ghost"} icon={icon}>
        {children}
      </SubmitButton>
    </form>
  );
}

/** Jobs still marked as building that the runner isn't on: it only builds one at a time. */
function Abandoned({ jobs }: { jobs: JobRow[] }) {
  if (jobs.length === 0) return null;
  return (
    <Section title="Abandoned" count={jobs.length} action={<StatusMark icon={WarningCircle} tone="warn" label="Not running" detail="The runner builds one site at a time and moved on without finishing these." />}>
      <Card>
        <ul className="divide-ink/8 divide-y">
          {jobs.map((job) => (
            <li key={job.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <SiteLink job={job} />
              <span className="text-ink-faint min-w-0 flex-1 truncate text-sm" title={job.step}>
                Started <When date={job.startedAt ?? job.claimedAt} /> and stopped {job.step ? `at step ${stepParts(job.step).done} of ${stepParts(job.step).total}: ${stepParts(job.step).words.toLowerCase()}` : "before its first step"}.
              </span>
              <SettleButton job={job} intent="requeue" icon={<ArrowCounterClockwise size={16} aria-hidden="true" />}>
                Put back in queue
              </SettleButton>
              <SettleButton job={job} intent="fail" icon={<XCircle size={16} aria-hidden="true" />}>
                Mark failed
              </SettleButton>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}

function outcomeOf(job: JobRow): { icon: Icon; tone: "good" | "bad" | "quiet" | "warn"; label: string } {
  if (isSkipped(job)) return { icon: MinusCircle, tone: "quiet", label: "Skipped" };
  if (job.status === "done") return { icon: CheckCircle, tone: "good", label: job.kind === "launch" ? "Launched" : "Built" };
  if (job.status === "waiting_for_usage") return { icon: HourglassMedium, tone: "warn", label: "Paused" };
  return { icon: WarningCircle, tone: "bad", label: JOB_STATUS_LABEL[job.status] };
}

function FinishedBuild({ job }: { job: JobRow }) {
  const outcome = outcomeOf(job);
  return (
    <li className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 px-5 py-3 text-sm sm:grid-cols-[6rem_minmax(0,1fr)_auto]">
      <StatusMark icon={outcome.icon} tone={outcome.tone} label={outcome.label} detail={job.criticVerdict || job.step || undefined} />
      <span className="min-w-0 truncate">
        <SiteLink job={job} />
      </span>
      <span className="text-ink-faint col-start-2 tabular-nums sm:col-start-3">
        {job.finishedAt && <time dateTime={job.finishedAt.toISOString()}>{finishedClock.format(job.finishedAt)}</time>}
        {job.minutes ? ` after ${minutesText(job.minutes)}` : ""}
        {job.apiEquivalentUsd ? ` (${usd.format(job.apiEquivalentUsd)} of Claude usage)` : ""}
      </span>
    </li>
  );
}

function History({ history, now }: { history: BuildHistory; now: number }) {
  if (history.total === 0) return null;
  return (
    <Section id="history" title="History" count={history.total}>
      <div className="flex flex-col gap-6">
        {jobsByDay(history.jobs, now).map((day) => (
          <div key={day.label} className="flex flex-col gap-2">
            <h3 className="text-ink-soft text-sm font-semibold">{day.label}</h3>
            <Card>
              <ul className="divide-ink/8 divide-y">
                {day.jobs.map((job) => (
                  <FinishedBuild key={job.id} job={job} />
                ))}
              </ul>
            </Card>
          </div>
        ))}
      </div>
      <Pager page={history.page} pages={history.pages} back="Newer" forward="Older" href={(page) => `/admin/builds${page > 1 ? `?page=${page}` : ""}#history`} />
    </Section>
  );
}

function Paused({ until, now }: { until: Date; now: number }) {
  return (
    <div className="flex items-center gap-2">
      <StatusMark icon={HourglassMedium} tone="warn" label={`Paused until ${clockTime(until, now)}`} detail="Claude's usage limit was hit." />
      <form action={resumeRunnerAction}>
        <SubmitButton size="sm" variant="ghost" icon={<Play size={16} aria-hidden="true" />}>
          Resume
        </SubmitButton>
      </form>
    </div>
  );
}

export default async function BuildsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  const [status, day, history] = await Promise.all([runnerStatus(), runnerDay(), buildHistory(pageFrom(page))]);

  return (
    <>
      <PageHeader title="Builds">
        <span className="text-ink-soft text-sm tabular-nums" title={`A build usually takes ${minutesText(status.minutes)}.`}>
          {day.built} of {day.settings.dailyCap} today
        </span>
        {day.pausedUntil && <Paused until={day.pausedUntil} now={status.now} />}
        <LiveRefresh renderedAt={status.now} />
      </PageHeader>
      <Section title="Now building">{status.current.length > 0 ? status.current.map((job) => <Current key={job.id} job={job} now={status.now} />) : <Idle last={status.lastFinished} />}</Section>
      <Queue jobs={status.queue} now={status.now} />
      <Abandoned jobs={status.abandoned} />
      <History history={history} now={status.now} />
    </>
  );
}
