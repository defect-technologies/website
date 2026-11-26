"use client";

import { FloppyDisk, MagnifyingGlass } from "@phosphor-icons/react";
import { useActionState } from "react";
import { saveResearchAction, type ResearchResult } from "@/app/admin/(panel)/setup/outreach/actions";
import { MOST_SEARCHES_PER_NIGHT, type ResearchSettings, type Search } from "@/lib/research";
import { TextAreaField, TextField } from "../fields";
import SubmitButton from "../SubmitButton";
import Switch from "../Switch";
import { Card, Notice, SectionHeading } from "../ui";

type Props = { settings: ResearchSettings; tonight: Search[] };

/** The niches and areas the nightly lead search goes through, and the searches it takes next. */
export default function ResearchForm({ settings, tonight }: Props) {
  const [state, action] = useActionState(saveResearchAction, { ok: false, message: "" } as ResearchResult);
  return (
    <Card className="flex flex-col gap-5 p-5">
      <SectionHeading>Nightly lead search</SectionHeading>
      <form action={action} className="flex flex-col gap-5">
        <Switch name="enabled" defaultChecked={settings.enabled} label="Search each night and add businesses that need a redesign as leads" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextAreaField label="Niches" name="niches" defaultValue={settings.niches.join("\n")} placeholder={"auto repair\ntattoo studio"} hint="One a line" rows={6} />
          <TextAreaField label="Areas" name="areas" defaultValue={settings.areas.join("\n")} placeholder={"Pasadena, CA\nGlendale, CA"} hint="One a line" rows={6} />
        </div>
        <div className="w-40">
          <TextField label="Searches a night" name="searchesPerNight" type="number" min={1} max={MOST_SEARCHES_PER_NIGHT} defaultValue={settings.searchesPerNight} />
        </div>
        {state.message && <Notice tone={state.ok ? "good" : "bad"}>{state.message}</Notice>}
        <div>
          <SubmitButton variant="solid" icon={<FloppyDisk size={18} aria-hidden="true" />}>
            Save search list
          </SubmitButton>
        </div>
      </form>
      {settings.enabled && tonight.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm" aria-label="Next searches">
          {tonight.map((search) => (
            <li key={`${search.niche}|${search.area}`} className="text-ink-soft flex items-center gap-2">
              <MagnifyingGlass size={14} aria-hidden="true" />
              {search.niche} in {search.area}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
