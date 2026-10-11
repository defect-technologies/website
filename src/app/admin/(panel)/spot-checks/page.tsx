import { ArrowSquareOut, Check, FloppyDisk, SkipForward } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/admin/EmptyState";
import { TextAreaField, TextField } from "@/components/admin/fields";
import PreviewThumb from "@/components/admin/PreviewThumb";
import ShowMore from "@/components/admin/ShowMore";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, PageHeader, SectionHeading, When } from "@/components/admin/ui";
import { founderName } from "@/lib/founders";
import { SPOT_CHECK_ASPECTS } from "@/lib/spotChecks";
import { openSpotChecks, reviewedSpotChecks, spotCheckAverages, spotCheckSettings, type SpotCheckAverages, type SpotCheckRow } from "@/server/spotChecks";
import { saveSpotCheckAction, saveSpotCheckSettingsAction, skipSpotCheckAction } from "./actions";

export const metadata: Metadata = { title: "Spot checks" };

const percent = (share: number) => Math.round(share * 1000) / 10;

function RatingField({ name, label, hint }: { name: string; label: string; hint: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <p className="text-ink-faint text-sm text-pretty">{hint}</p>
      <div className="mt-1 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((value) => (
          <label
            key={value}
            className="border-ink/15 hover:border-ink/40 has-[:checked]:bg-ink has-[:checked]:text-paper has-[:checked]:border-ink has-[:focus-visible]:outline-ink grid size-10 cursor-pointer place-items-center rounded-full border text-base font-medium tabular-nums transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
          >
            <input type="radio" name={name} value={value} required className="sr-only" />
            {value}
            <span className="sr-only"> out of 5</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function OpenPreview({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-sm font-medium underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
      Open the preview <ArrowSquareOut size={14} aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function SpotCheckCard({ row }: { row: SpotCheckRow }) {
  const { check, businessName } = row;
  return (
    <Card className="grid gap-5 p-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        <PreviewThumb url={check.previewUrl} name={businessName} />
        <OpenPreview url={check.previewUrl} />
      </div>
      <form action={saveSpotCheckAction} className="flex min-w-0 flex-col gap-4">
        <input type="hidden" name="id" value={check.id} />
        <header className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 className="text-lg font-semibold">
            <Link href={`/admin/pipeline/${check.businessId}`} className="hover:underline">
              {businessName}
            </Link>
          </h3>
          <span className="text-ink-faint text-sm">
            Picked <When date={check.sampledAt} />
          </span>
        </header>
        <div className="grid gap-4 sm:grid-cols-3">
          {SPOT_CHECK_ASPECTS.map((aspect) => (
            <RatingField key={aspect.field} name={aspect.field} label={aspect.label} hint={aspect.hint} />
          ))}
        </div>
        <TextAreaField
          label="Note"
          name="note"
          id={`note-${check.id}`}
          maxLength={4000}
          placeholder="What would you change? The builder reads these notes."
          hint="Say what's wrong and where, like “the hero headline wraps to four lines on a phone”."
        />
        <div className="flex flex-wrap gap-2">
          <SubmitButton variant="solid" size="sm" icon={<Check size={16} weight="bold" aria-hidden="true" />}>
            Save
          </SubmitButton>
          <SubmitButton variant="ghost" size="sm" formAction={skipSpotCheckAction} formNoValidate icon={<SkipForward size={16} aria-hidden="true" />}>
            Skip
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}

function Score({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-faint">–</span>;
  return <span className={`tabular-nums ${value <= 2 ? "text-bad font-semibold" : ""}`}>{value}</span>;
}

function Averages({ averages }: { averages: SpotCheckAverages }) {
  if (averages.checks === 0) return null;
  const format = (value: number | null) => (value === null ? "–" : value.toFixed(1));
  return (
    <p className="text-ink-soft text-sm">
      Last 30 days, {averages.checks} {averages.checks === 1 ? "check" : "checks"}: copy <span className="text-ink font-semibold tabular-nums">{format(averages.copy)}</span>, typography{" "}
      <span className="text-ink font-semibold tabular-nums">{format(averages.typography)}</span>, layout <span className="text-ink font-semibold tabular-nums">{format(averages.layout)}</span> out of 5.
    </p>
  );
}

function PastResult({ row }: { row: SpotCheckRow }) {
  const { check, businessName } = row;
  return (
    <li className="border-ink/8 grid gap-x-4 gap-y-1 border-b pb-3 text-sm last:border-b-0 sm:grid-cols-[minmax(0,14rem)_9rem_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col">
        <a href={check.previewUrl} target="_blank" rel="noreferrer" className="truncate font-medium hover:underline">
          {businessName}
          <span className="sr-only"> preview (opens in a new tab)</span>
        </a>
        <span className="text-ink-faint">
          {founderName(check.reviewedBy)}, <When date={check.reviewedAt} />
        </span>
      </div>
      <dl className="flex gap-3">
        {SPOT_CHECK_ASPECTS.map((aspect) => (
          <div key={aspect.field} className="flex flex-col items-center">
            <dt className="text-ink-faint text-xs">{aspect.short}</dt>
            <dd>
              <Score value={check[aspect.field]} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-pretty whitespace-pre-wrap">{check.note || <span className="text-ink-faint">No note</span>}</p>
    </li>
  );
}

function SettingsForm({ share }: { share: number }) {
  return (
    <form action={saveSpotCheckSettingsAction} className="flex flex-wrap items-end gap-3">
      <div className="w-44">
        <TextField label="Share of previews (%)" name="percent" type="number" min={0} max={100} step={0.5} defaultValue={percent(share)} required />
      </div>
      <SubmitButton size="sm" icon={<FloppyDisk size={16} aria-hidden="true" />}>
        Save
      </SubmitButton>
    </form>
  );
}

export default async function SpotChecksPage() {
  const [open, reviewed, averages, settings] = await Promise.all([openSpotChecks(), reviewedSpotChecks(), spotCheckAverages(), spotCheckSettings()]);

  return (
    <>
      <PageHeader title="Spot checks" />
      <p className="text-ink-soft -mt-4 max-w-prose text-pretty">
        Every finished preview has a {percent(settings.share)}% chance of landing here. Rate its copy, typography and layout from 1 to 5 and say what you&apos;d change. The preview
        runner reads the notes, so the builder can learn from them.
      </p>
      <section className="flex flex-col gap-4">
        <SectionHeading count={open.length}>Waiting</SectionHeading>
        {open.length === 0 ? (
          <EmptyState title="Nothing to check">The next preview picked for a spot check shows up here.</EmptyState>
        ) : (
          open.map((row) => <SpotCheckCard key={row.check.id} row={row} />)
        )}
      </section>
      <section className="flex flex-col gap-4">
        <SectionHeading count={reviewed.length}>Results</SectionHeading>
        <Averages averages={averages} />
        {reviewed.length === 0 ? (
          <p className="text-ink-soft text-sm">No preview has been rated yet.</p>
        ) : (
          <Card className="p-5">
            <ShowMore items={reviewed.map((row) => <PastResult key={row.check.id} row={row} />)} />
          </Card>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <SectionHeading>Setting</SectionHeading>
        <SettingsForm share={settings.share} />
      </section>
    </>
  );
}
