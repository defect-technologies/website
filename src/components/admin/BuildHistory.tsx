import { CheckCircle, EyeSlash, HourglassMedium, MinusCircle, RocketLaunch, SquaresFour, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { minutesText } from "@/components/admin/BuildProgress";
import EmptyState from "@/components/admin/EmptyState";
import Pager from "@/components/admin/Pager";
import { Card, Section, StatusMark, type StatusTone } from "@/components/admin/ui";
import { jobsByDay } from "@/lib/buildStatus";
import { BUILD_OUTCOME_LABEL, BUILD_OUTCOMES, buildOutcome, type BuildOutcome } from "@/lib/previewJobs";
import type { BuildHistory as History } from "@/server/runner/history";
import type { JobRow } from "@/server/runner/status";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const finishedClock = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" });

const OUTCOME_LOOK: Record<BuildOutcome, { icon: Icon; tone: StatusTone }> = {
  built: { icon: CheckCircle, tone: "good" },
  launched: { icon: RocketLaunch, tone: "good" },
  boards: { icon: SquaresFour, tone: "quiet" },
  failed: { icon: WarningCircle, tone: "bad" },
  skipped: { icon: MinusCircle, tone: "quiet" },
  paused: { icon: HourglassMedium, tone: "warn" },
};

export function SiteLink({ job }: { job: JobRow }) {
  return (
    <Link href={`/admin/sites/${job.businessId}`} className="font-semibold hover:underline">
      {job.businessName}
    </Link>
  );
}

function historyHref(hidden: BuildOutcome[], page = 1): string {
  const query = new URLSearchParams();
  if (hidden.length > 0) query.set("hide", hidden.join(","));
  if (page > 1) query.set("page", String(page));
  const text = query.toString().replaceAll("%2C", ",");
  return `/admin/builds${text ? `?${text}` : ""}`;
}

function withToggled(hidden: BuildOutcome[], outcome: BuildOutcome): BuildOutcome[] {
  const next = hidden.includes(outcome) ? hidden.filter((other) => other !== outcome) : [...hidden, outcome];
  return BUILD_OUTCOMES.filter((other) => next.includes(other));
}

function OutcomeToggle({ outcome, history }: { outcome: BuildOutcome; history: History }) {
  const look = OUTCOME_LOOK[outcome];
  const label = BUILD_OUTCOME_LABEL[outcome];
  const isHidden = history.hidden.includes(outcome);
  const action = `${isHidden ? "Show" : "Hide"} ${label.toLowerCase()} builds`;
  return (
    <Link
      href={historyHref(withToggled(history.hidden, outcome))}
      scroll={false}
      replace
      aria-label={`${action}, ${history.counts[outcome]}`}
      title={action}
      className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-2.5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ink ${isHidden ? "hover:bg-paper-shade" : "bg-surface shadow-card hover:bg-paper-shade"}`}
    >
      {isHidden ? <StatusMark icon={EyeSlash} label={<span className="line-through">{label}</span>} /> : <StatusMark icon={look.icon} tone={look.tone} label={label} />}
      <span className="text-ink-faint text-sm tabular-nums">{history.counts[outcome]}</span>
    </Link>
  );
}

function OutcomeToggles({ history }: { history: History }) {
  const outcomes = BUILD_OUTCOMES.filter((outcome) => history.counts[outcome] > 0);
  if (outcomes.length < 2) return null;
  return (
    <div role="group" aria-label="Show or hide builds by how they ended" className="flex flex-wrap gap-2">
      {outcomes.map((outcome) => (
        <OutcomeToggle key={outcome} outcome={outcome} history={history} />
      ))}
    </div>
  );
}

function FinishedBuild({ job }: { job: JobRow }) {
  const outcome = buildOutcome(job);
  const look = OUTCOME_LOOK[outcome];
  return (
    <li className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 px-5 py-3 text-sm sm:grid-cols-[6rem_minmax(0,1fr)_auto]">
      <StatusMark icon={look.icon} tone={look.tone} label={BUILD_OUTCOME_LABEL[outcome]} detail={job.criticVerdict || job.step || undefined} />
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

function Days({ history, now }: { history: History; now: number }) {
  return (
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
  );
}

/** Every finished build by day, a page at a time, with toggles that hide builds by how they ended. */
export default function BuildHistory({ history, now }: { history: History; now: number }) {
  if (history.shown === 0 && history.hidden.length === 0) return null;
  return (
    <Section id="history" title="History" count={history.shown} action={<OutcomeToggles history={history} />}>
      {history.shown === 0 ? (
        <EmptyState
          title="Every build is hidden"
          action={
            <ButtonLink href="/admin/builds" size="sm" scroll={false} replace>
              Show all builds
            </ButtonLink>
          }
        />
      ) : (
        <Days history={history} now={now} />
      )}
      <Pager page={history.page} pages={history.pages} back="Newer" forward="Older" href={(page) => `${historyHref(history.hidden, page)}#history`} />
    </Section>
  );
}
