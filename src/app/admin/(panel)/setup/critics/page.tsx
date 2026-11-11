import { Check, FloppyDisk, Question, ShieldCheck, X } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { TextField } from "@/components/admin/fields";
import SubmitButton from "@/components/admin/SubmitButton";
import Switch from "@/components/admin/Switch";
import { Card, PageHeader } from "@/components/admin/ui";
import { acceptedShare, CRITIC_KINDS, type CriticKind, hasEarnedTrust, KIND_LABEL, type KindTally, MAX_CRITIC_MINUTES, MIN_CRITIC_MINUTES } from "@/lib/critics";
import { kindTallies } from "@/server/review/criticProposals";
import { criticSettings } from "@/server/review/criticSettings";
import { saveCriticSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Critics" };

const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_9rem_repeat(3,4.5rem)_auto]";

function Count({ icon: CountIcon, value, label }: { icon: typeof Check; value: number; label: string }) {
  return (
    <span className="text-ink-soft inline-flex items-center gap-1.5 tabular-nums" title={label}>
      <CountIcon size={16} aria-hidden="true" />
      {value}
      <span className="sr-only">{label}</span>
    </span>
  );
}

function ShareBar({ tally, earned }: { tally: KindTally; earned: boolean }) {
  const share = acceptedShare(tally);
  return (
    <div className="flex items-center gap-2 max-sm:col-span-2">
      <div className="bg-ink/10 h-2 min-w-0 flex-1 overflow-hidden rounded-full">
        <div className={`h-full rounded-full ${earned ? "bg-good" : "bg-ink/40"}`} style={{ width: `${Math.round((share ?? 0) * 100)}%` }} />
      </div>
      <span className={`w-10 text-end text-sm tabular-nums ${earned ? "text-good font-semibold" : "text-ink-soft"}`}>{share === null ? "none" : `${Math.round(share * 100)}%`}</span>
    </div>
  );
}

function KindRow({ kind, tally, applied }: { kind: CriticKind; tally: KindTally; applied: boolean }) {
  const earned = hasEarnedTrust(tally);
  return (
    <li className={`${ROW_GRID} px-5 py-3 ${earned ? "bg-good/10" : ""}`}>
      <span className="flex min-w-0 items-center gap-2 font-medium">
        {earned && <ShieldCheck size={20} weight="fill" className="text-good shrink-0" aria-label="Earned trust: accepted at least 90% of at least 10 proposals" />}
        {KIND_LABEL[kind]}
      </span>
      <ShareBar tally={tally} earned={earned} />
      <div className="col-span-2 flex gap-5 sm:contents">
        <Count icon={Check} value={tally.accepted} label="proposals accepted" />
        <Count icon={X} value={tally.rejected} label="proposals rejected" />
        <Count icon={Question} value={tally.missed} label="notes you wrote that no critic proposed" />
      </div>
      <Switch name="apply" value={kind} defaultChecked={applied} label={`Apply ${KIND_LABEL[kind]} notes without me`} hideLabel className="justify-self-end max-sm:row-start-1 max-sm:col-start-2" />
    </li>
  );
}

function ColumnHeads() {
  return (
    <div className={`${ROW_GRID} text-ink-faint px-5 pb-2 text-sm max-sm:hidden`} aria-hidden="true">
      <span />
      <span>Accepted share</span>
      <span>Accepted</span>
      <span>Rejected</span>
      <span>Missed</span>
      <span className="w-10 text-end">Apply</span>
    </div>
  );
}

/** What the founders have taught the pipeline: which kinds of critic note they agree with, and which the builder may apply alone. */
export default async function CriticsPage() {
  const [settings, tallies] = await Promise.all([criticSettings(), kindTallies()]);
  return (
    <>
      <PageHeader title="Critics" />
      <form action={saveCriticSettingsAction} className="flex flex-col gap-6">
        <Card className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 p-5">
          <Switch name="enabled" defaultChecked={settings.enabled} label="Run critics on every build" />
          <div className="w-36">
            <TextField label="Minutes per build" name="minutes" type="number" min={MIN_CRITIC_MINUTES} max={MAX_CRITIC_MINUTES} defaultValue={settings.minutes} required />
          </div>
        </Card>
        <Card className="overflow-hidden py-4">
          <ColumnHeads />
          <ul className="divide-ink/8 divide-y">
            {CRITIC_KINDS.map((kind) => (
              <KindRow key={kind} kind={kind} tally={tallies[kind]} applied={settings.apply.includes(kind)} />
            ))}
          </ul>
        </Card>
        <SubmitButton className="w-fit" icon={<FloppyDisk size={18} aria-hidden="true" />}>
          Save
        </SubmitButton>
      </form>
    </>
  );
}
