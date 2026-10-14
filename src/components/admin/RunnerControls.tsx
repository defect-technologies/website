import { FloppyDisk } from "@phosphor-icons/react/dist/ssr";
import { saveRunnerSettingsAction } from "@/app/admin/(panel)/setup/bots/actions";
import type { RunnerSettings } from "@/lib/previewJobs";
import { TextField } from "./fields";
import SubmitButton from "./SubmitButton";

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
