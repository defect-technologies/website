import { ArrowSquareOut, Check, SkipForward } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { saveSpotCheckAction, skipSpotCheckAction } from "@/app/admin/(panel)/setup/spot-checks/actions";
import { SPOT_CHECK_ASPECTS } from "@/lib/spotChecks";
import type { SpotCheckRow } from "@/server/spotChecks";
import { TextAreaField } from "./fields";
import PreviewThumb from "./PreviewThumb";
import SubmitButton from "./SubmitButton";
import { Card, InfoTip, When } from "./ui";

function RatingField({ name, label, hint }: { name: string; label: string; hint: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="flex items-center gap-1 text-sm font-medium">
        {label}
        <InfoTip>{hint}</InfoTip>
      </legend>
      <div className="flex gap-1.5">
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

/** A random finished preview to rate for copy, typography and layout. */
export default function SpotCheckCard({ row }: { row: SpotCheckRow }) {
  const { check, businessName } = row;
  return (
    <Card className="grid gap-5 p-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        <PreviewThumb url={check.previewUrl} name={businessName} />
        <a href={check.previewUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-sm font-medium underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
          Open preview <ArrowSquareOut size={14} aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <form action={saveSpotCheckAction} className="flex min-w-0 flex-col gap-4">
        <input type="hidden" name="id" value={check.id} />
        <header className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 className="text-lg font-semibold">
            <Link href={`/admin/sites/${check.businessId}`} className="hover:underline">
              {businessName}
            </Link>
          </h3>
          <span className="text-ink-faint text-sm">
            <When date={check.sampledAt} />
          </span>
        </header>
        <div className="flex flex-col gap-4">
          {SPOT_CHECK_ASPECTS.map((aspect) => (
            <RatingField key={aspect.field} name={aspect.field} label={aspect.label} hint={aspect.hint} />
          ))}
        </div>
        <TextAreaField label="Note" name="note" id={`note-${check.id}`} maxLength={4000} placeholder="What's wrong, and where?" />
        <div className="flex flex-wrap gap-2">
          <SubmitButton variant="solid" size="sm" icon={<Check size={16} weight="bold" aria-hidden="true" />}>
            Save rating
          </SubmitButton>
          <SubmitButton variant="ghost" size="sm" formAction={skipSpotCheckAction} formNoValidate icon={<SkipForward size={16} aria-hidden="true" />}>
            Skip
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}
