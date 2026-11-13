import { FloppyDisk } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { saveRunnerSettingsAction } from "@/app/admin/(panel)/setup/bots/actions";
import type { RunnerSettings } from "@/lib/previewJobs";
import { TextField } from "./fields";
import SubmitButton from "./SubmitButton";

/** One switch of the runner's settings. Its label says what happens while it is on. */
function Setting({ name, on, children }: { name: keyof RunnerSettings; on: boolean; children: ReactNode }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={on} className="accent-ink size-4 shrink-0" />
      {children}
    </label>
  );
}

export function RunnerSettingsForm({ settings }: { settings: RunnerSettings }) {
  return (
    <form action={saveRunnerSettingsAction} className="flex flex-col items-start gap-4">
      <div className="w-36">
        <TextField label="Builds a day" name="dailyCap" type="number" min={0} max={100} defaultValue={settings.dailyCap} required />
      </div>
      <div className="flex flex-col gap-1">
        <Setting name="autoQueue" on={settings.autoQueue}>
          Build previews for new leads automatically
        </Setting>
        <Setting name="designBoards" on={settings.designBoards}>
          Stop each first build for a founder to choose its design
        </Setting>
        <Setting name="tellFounders" on={settings.tellFounders}>
          Email both founders when a design or a site waits for them
        </Setting>
        <Setting name="outreachPicksPreviews" on={settings.outreachPicksPreviews}>
          Let the Outreach bot request previews
        </Setting>
      </div>
      <SubmitButton size="sm" icon={<FloppyDisk size={16} aria-hidden="true" />}>
        Save
      </SubmitButton>
    </form>
  );
}
