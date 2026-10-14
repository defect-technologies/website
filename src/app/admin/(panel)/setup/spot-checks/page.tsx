import { FloppyDisk } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import EmptyState from "@/components/admin/EmptyState";
import { TextField } from "@/components/admin/fields";
import ShowMore from "@/components/admin/ShowMore";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, PageHeader, When } from "@/components/admin/ui";
import { founderName } from "@/lib/founders";
import { SPOT_CHECK_ASPECTS } from "@/lib/spotChecks";
import { reviewedSpotChecks, spotCheckAverages, spotCheckSettings, type SpotCheckAverages, type SpotCheckRow } from "@/server/spotChecks";
import { saveSpotCheckSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Spot checks" };

const percent = (share: number) => Math.round(share * 1000) / 10;

function Score({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-faint">–</span>;
  return <span className={`tabular-nums ${value <= 2 ? "text-bad font-semibold" : ""}`}>{value}</span>;
}

function Averages({ averages }: { averages: SpotCheckAverages }) {
  if (averages.checks === 0) return null;
  const format = (value: number | null) => (value === null ? "–" : value.toFixed(1));
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-2">
      {SPOT_CHECK_ASPECTS.map((aspect) => (
        <div key={aspect.field} className="flex flex-col">
          <dt className="text-ink-faint text-sm">{aspect.label}</dt>
          <dd className="font-display text-4xl leading-none font-black tabular-nums">{format(averages[aspect.label.toLowerCase() as "copy" | "typography" | "layout"])}</dd>
        </div>
      ))}
      <div className="flex flex-col justify-end">
        <dt className="sr-only">Checks</dt>
        <dd className="text-ink-faint text-sm tabular-nums">{averages.checks} in 30 days, out of 5</dd>
      </div>
    </dl>
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
        <TextField label="Share picked (%)" name="percent" type="number" min={0} max={100} step={0.5} defaultValue={percent(share)} required />
      </div>
      <SubmitButton size="sm" icon={<FloppyDisk size={16} aria-hidden="true" />}>
        Save
      </SubmitButton>
    </form>
  );
}

export default async function SpotChecksPage() {
  const [reviewed, averages, settings] = await Promise.all([reviewedSpotChecks(), spotCheckAverages(), spotCheckSettings()]);

  return (
    <>
      <PageHeader title="Spot checks">
        <SettingsForm share={settings.share} />
      </PageHeader>
      <Averages averages={averages} />
      {reviewed.length === 0 ? (
        <EmptyState title="No ratings yet" />
      ) : (
        <Card className="p-5">
          <ShowMore items={reviewed.map((row) => <PastResult key={row.check.id} row={row} />)} />
        </Card>
      )}
    </>
  );
}
