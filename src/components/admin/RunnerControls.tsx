import { FloppyDisk, Play } from "@phosphor-icons/react/dist/ssr";
import { resumeRunnerAction, saveRunnerSettingsAction } from "@/app/admin/(panel)/bots/actions";
import type { RunnerSettings } from "@/lib/previewJobs";
import type { RunnerDay } from "@/server/overview";
import { TextField } from "./fields";
import SubmitButton from "./SubmitButton";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const pacific = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles", timeZoneName: "short" });

/** Builds since midnight Pacific against the daily cap, and what they'd have cost at API prices. */
export function BuildsToday({ day }: { day: RunnerDay }) {
  return (
    <p className="tabular-nums">
      <span className="font-semibold">{day.built}</span>
      <span className="text-ink-faint"> of {day.settings.dailyCap} builds today</span>
      {day.spent > 0 && <span className="text-ink-faint">, about {usd.format(day.spent)}</span>}
    </p>
  );
}

export function PausedNotice({ until }: { until: Date }) {
  return (
    <div className="bg-warn/10 text-warn flex flex-col items-start gap-2 rounded-xl px-3 py-2.5">
      <p className="text-pretty">Claude&apos;s usage limit was hit. Builds wait until {pacific.format(until)}.</p>
      <form action={resumeRunnerAction}>
        <SubmitButton size="sm" icon={<Play size={16} aria-hidden="true" />}>
          Resume now
        </SubmitButton>
      </form>
    </div>
  );
}

export function RunnerSettingsForm({ settings }: { settings: RunnerSettings }) {
  return (
    <form action={saveRunnerSettingsAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="w-36">
        <TextField label="Builds a day" name="dailyCap" type="number" min={0} max={100} defaultValue={settings.dailyCap} required />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="autoQueue" defaultChecked={settings.autoQueue} className="accent-ink size-4" />
        Build previews for new leads automatically
      </label>
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
