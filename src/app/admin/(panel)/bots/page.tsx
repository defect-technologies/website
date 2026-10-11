import { ArrowsClockwise, CheckCircle, Clock, Prohibit, Warning } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import CreateBotKeyForm from "@/components/admin/CreateBotKeyForm";
import { RunnerSettingsForm } from "@/components/admin/RunnerControls";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, Notice, PageHeader, SectionHeading, StageChip, When } from "@/components/admin/ui";
import { BOT_JOB, BOT_LABEL, BOT_STAGES, BOTS, type Bot } from "@/lib/bots";
import type { BotKey } from "@/server/db/schema";
import { instructionsStatus, type InstructionsStatus } from "@/server/bots/instructions";
import { listBotKeys } from "@/server/bots/keys";
import { runnerSettings } from "@/server/runner/settings";
import { revokeBotKeyAction } from "./actions";

export const metadata: Metadata = { title: "Bots" };

const SPEC_BOTS = BOTS.filter((bot) => bot !== "runner");

function KeyRow({ botKey }: { botKey: BotKey }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
      <span className="min-w-32 font-medium">{botKey.name}</span>
      <span className="text-ink-faint text-sm">
        Used <When date={botKey.lastUsedAt} />
      </span>
      <span className="text-ink-faint text-sm">
        Last check-in <When date={botKey.lastHeartbeatAt} />
        {botKey.lastRoutine && ` from “${botKey.lastRoutine}”`}
      </span>
      <form action={revokeBotKeyAction} className="ms-auto">
        <input type="hidden" name="id" value={botKey.id} />
        <SubmitButton size="sm" variant="ghost" icon={<Prohibit size={16} aria-hidden="true" />}>
          Revoke
        </SubmitButton>
      </form>
    </li>
  );
}

const Version = ({ version }: { version: string }) => <code className="font-mono text-xs">{version}</code>;

/** Whether the bot has fetched the instructions now on main. It fetches them at the start of every run. */
function InstructionsLine({ status }: { status: InstructionsStatus }) {
  const line = "flex items-start gap-2 text-sm";
  if (status.kind === "unconfigured") return null;
  if (status.kind === "unavailable") {
    return (
      <p className={`${line} text-warn`}>
        <Warning size={18} aria-hidden="true" className="shrink-0" />
        {status.reason}
      </p>
    );
  }
  if (status.kind === "current") {
    return (
      <p className={`${line} text-good`}>
        <CheckCircle size={18} weight="fill" aria-hidden="true" className="shrink-0" />
        <span>
          Running the latest instructions, <Version version={status.latest} />
        </span>
      </p>
    );
  }
  const Icon = status.kind === "never" ? Clock : ArrowsClockwise;
  return (
    <p className={`${line} text-ink-soft`}>
      <Icon size={18} aria-hidden="true" className="shrink-0" />
      <span>
        {status.kind === "never" ? "Hasn’t fetched its instructions yet" : <>Still on <Version version={status.loaded} /></>}. Picks up{" "}
        <Version version={status.latest} /> on its next run.
      </span>
    </p>
  );
}

function BotCard({ bot, keys, instructions, children }: { bot: Bot; keys: BotKey[]; instructions?: InstructionsStatus; children?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <SectionHeading>{BOT_LABEL[bot]}</SectionHeading>
        <p className="text-ink-soft text-pretty">{BOT_JOB[bot]}</p>
      </div>
      {BOT_STAGES[bot].length > 0 && (
        <div className="flex flex-col gap-2">
          <p id={`${bot}-stages`} className="text-ink-faint text-sm">
            Leads it can reach
          </p>
          <ul className="flex flex-wrap gap-1.5" aria-labelledby={`${bot}-stages`}>
            {BOT_STAGES[bot].map((stage) => (
              <li key={stage}>
                <StageChip stage={stage} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {keys.length > 0 && (
        <ul className="divide-ink/8 divide-y">
          {keys.map((botKey) => (
            <KeyRow key={botKey.id} botKey={botKey} />
          ))}
        </ul>
      )}
      {instructions && <InstructionsLine status={instructions} />}
      <CreateBotKeyForm bot={bot} />
      {children}
    </Card>
  );
}

export default async function BotsPage() {
  const [allKeys, builder, statuses] = await Promise.all([listBotKeys(), runnerSettings(), Promise.all(SPEC_BOTS.map(instructionsStatus))]);
  const instructions = new Map<Bot, InstructionsStatus>(SPEC_BOTS.map((bot, index) => [bot, statuses[index]]));
  const keys = allKeys.filter((botKey) => !botKey.revokedAt);
  return (
    <>
      <PageHeader title="Bots" />
      {statuses.some((status) => status.kind === "unconfigured") && (
        <Notice tone="warn" className="mb-6">
          The bots can&apos;t fetch their instructions from GitHub until GITHUB_READ_TOKEN is set in Vercel: a fine-grained token with
          read-only Contents access to defect-technologies/defect-tech.
        </Notice>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        {BOTS.map((bot) => (
          <BotCard key={bot} bot={bot} keys={keys.filter((botKey) => botKey.bot === bot)} instructions={instructions.get(bot)}>
            {bot === "runner" && <RunnerSettingsForm settings={builder} />}
          </BotCard>
        ))}
      </div>
    </>
  );
}
