import { ArrowsClockwise, CheckCircle, Clock, Prohibit, Warning } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import CreateBotKeyForm from "@/components/admin/CreateBotKeyForm";
import { RunnerSettingsForm } from "@/components/admin/RunnerControls";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, InfoTip, Notice, PageHeader, SectionHeading, StatusMark, When } from "@/components/admin/ui";
import { BOT_JOB, BOT_LABEL, BOT_STAGES, BOTS, type Bot } from "@/lib/bots";
import { STAGE_LABEL } from "@/lib/stages";
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
      <span className="text-ink-faint text-sm" title={botKey.lastRoutine ? `Last routine: ${botKey.lastRoutine}` : undefined}>
        Checked in <When date={botKey.lastHeartbeatAt ?? botKey.lastUsedAt} />
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

/** Whether the bot has fetched the instructions now on main. It fetches them at the start of every run. */
function InstructionsLine({ status }: { status: InstructionsStatus }) {
  if (status.kind === "unconfigured") return null;
  if (status.kind === "unavailable") return <StatusMark icon={Warning} tone="warn" label="Instructions unavailable" detail={status.reason} />;
  if (status.kind === "current") return <StatusMark icon={CheckCircle} tone="good" label="Latest instructions" detail={status.latest} />;
  if (status.kind === "never") return <StatusMark icon={Clock} label="No instructions yet" detail={`Picks up ${status.latest} on its next run.`} />;
  return <StatusMark icon={ArrowsClockwise} label="Updates next run" detail={`Still on ${status.loaded}. Picks up ${status.latest} on its next run.`} />;
}

const reachText = (bot: Bot) => (BOT_STAGES[bot].length > 0 ? ` Reaches leads that are: ${BOT_STAGES[bot].map((stage) => STAGE_LABEL[stage].toLowerCase()).join(", ")}.` : "");

function BotCard({ bot, keys, instructions, children }: { bot: Bot; keys: BotKey[]; instructions?: InstructionsStatus; children?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <SectionHeading>{BOT_LABEL[bot]}</SectionHeading>
          <InfoTip>{`${BOT_JOB[bot]}${reachText(bot)}`}</InfoTip>
        </div>
        {instructions && <InstructionsLine status={instructions} />}
      </div>
      {keys.length > 0 && (
        <ul className="divide-ink/8 divide-y">
          {keys.map((botKey) => (
            <KeyRow key={botKey.id} botKey={botKey} />
          ))}
        </ul>
      )}
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
        <Notice tone="warn">Set GITHUB_READ_TOKEN in Vercel (read-only Contents on defect-technologies/defect-tech) so the bots can fetch their instructions.</Notice>
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
