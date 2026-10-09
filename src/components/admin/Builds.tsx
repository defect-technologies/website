import { ArrowSquareOut, FloppyDisk, Play } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { resumeRunnerAction, saveRunnerSettingsAction } from "@/app/admin/(panel)/projects/actions";
import { JOB_STATUS_LABEL, type RunnerSettings } from "@/lib/previewJobs";
import type { BotKey } from "@/server/db/schema";
import type { JobRow } from "@/server/runner/jobs";
import { TextField } from "./fields";
import SubmitButton from "./SubmitButton";
import { Notice, When } from "./ui";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const pacific = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles", timeZoneName: "short" });

const isBuilding = (job: JobRow) => job.status === "claimed" || job.status === "running";

function JobLine({ job }: { job: JobRow }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
      <Link href={`/admin/pipeline/${job.businessId}`} className="font-medium hover:underline">
        {job.businessName}
      </Link>
      {isBuilding(job) && <span className="text-ink-faint">{job.step || JOB_STATUS_LABEL[job.status]}</span>}
      {job.previewUrl && (
        <a href={job.previewUrl} target="_blank" rel="noreferrer" className="text-ink-soft inline-flex items-center gap-1 hover:underline">
          Open preview <ArrowSquareOut size={14} aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
      {job.apiEquivalentUsd !== null && <span className="text-ink-faint tabular-nums">{usd.format(job.apiEquivalentUsd)}</span>}
    </li>
  );
}

function JobGroup({ title, jobs, empty }: { title: string; jobs: JobRow[]; empty?: string }) {
  if (jobs.length === 0 && !empty) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">
        {title} <span className="text-ink-faint font-normal tabular-nums">{jobs.length}</span>
      </h3>
      {jobs.length === 0 ? (
        <p className="text-ink-soft text-sm">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {jobs.map((job) => (
            <JobLine key={job.id} job={job} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Today({ built, cap, spent }: { built: number; cap: number; spent: number }) {
  return (
    <p className="text-sm tabular-nums">
      <span className="text-xl font-semibold">{built}</span>
      <span className="text-ink-faint"> of {cap} builds today</span>
      {spent > 0 && <span className="text-ink-faint">, about {usd.format(spent)} at API prices</span>}
    </p>
  );
}

function Paused({ until }: { until: Date }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Notice tone="warn">Claude&apos;s usage limit was hit. Builds wait until {pacific.format(until)}, then pick up where they left off.</Notice>
      <form action={resumeRunnerAction}>
        <SubmitButton size="sm" icon={<Play size={16} aria-hidden="true" />}>
          Resume now
        </SubmitButton>
      </form>
    </div>
  );
}

function RunnerStatus({ runnerKey }: { runnerKey: BotKey | undefined }) {
  if (!runnerKey) return <p className="text-ink-soft text-sm">No runner is connected yet. Create its key on the Bots page.</p>;
  return (
    <p className="text-ink-faint text-sm">
      {runnerKey.name} last asked for work <When date={runnerKey.lastUsedAt} />
    </p>
  );
}

function RunnerSettingsForm({ settings }: { settings: RunnerSettings }) {
  return (
    <form action={saveRunnerSettingsAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="w-36">
        <TextField label="Builds a day" name="dailyCap" type="number" min={0} max={100} defaultValue={settings.dailyCap} required />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="outreachPicksPreviews" defaultChecked={settings.outreachPicksPreviews} className="accent-ink size-4" />
        Let the Outreach bot request previews
      </label>
      <SubmitButton size="sm" icon={<FloppyDisk size={16} aria-hidden="true" />}>
        Save
      </SubmitButton>
    </form>
  );
}

const byStatus = (jobs: JobRow[], ...statuses: JobRow["status"][]) => jobs.filter((job) => statuses.includes(job.status));

/** The preview runner's queue, today's builds and its limits. */
export default function Builds(props: { jobs: JobRow[]; settings: RunnerSettings; builtToday: number; pausedUntil: Date | null; runnerKey: BotKey | undefined }) {
  const { jobs, settings, builtToday, pausedUntil, runnerKey } = props;
  const done = byStatus(jobs, "done");
  const spent = done.reduce((sum, job) => sum + (job.apiEquivalentUsd ?? 0), 0);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Today built={builtToday} cap={settings.dailyCap} spent={spent} />
        <RunnerStatus runnerKey={runnerKey} />
      </div>
      {pausedUntil && <Paused until={pausedUntil} />}
      <JobGroup title="Building" jobs={byStatus(jobs, "claimed", "running")} />
      <JobGroup title="Queued" jobs={byStatus(jobs, "queued")} empty="Nothing waiting. Use Build preview on a lead to queue one." />
      <JobGroup title="Failed today" jobs={byStatus(jobs, "failed")} />
      <JobGroup title="Built today" jobs={done} />
      <RunnerSettingsForm settings={settings} />
    </div>
  );
}
