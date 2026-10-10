import { Prohibit } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import CreateBotKeyForm from "@/components/admin/CreateBotKeyForm";
import { RunnerSettingsForm } from "@/components/admin/RunnerControls";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, PageHeader, SectionHeading, StageChip, When } from "@/components/admin/ui";
import { BOT_JOB, BOT_LABEL, BOT_STAGES, BOTS, type Bot } from "@/lib/bots";
import type { BotKey } from "@/server/db/schema";
import { listBotKeys } from "@/server/bots/keys";
import { runnerSettings } from "@/server/runner/settings";
import { revokeBotKeyAction } from "./actions";

export const metadata: Metadata = { title: "Bots" };

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

function BotCard({ bot, keys, children }: { bot: Bot; keys: BotKey[]; children?: ReactNode }) {
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
      <CreateBotKeyForm bot={bot} />
      {children}
    </Card>
  );
}

export default async function BotsPage() {
  const [allKeys, builder] = await Promise.all([listBotKeys(), runnerSettings()]);
  const keys = allKeys.filter((botKey) => !botKey.revokedAt);
  return (
    <>
      <PageHeader title="Bots" />
      <div className="grid gap-6 xl:grid-cols-2">
        {BOTS.map((bot) => (
          <BotCard key={bot} bot={bot} keys={keys.filter((botKey) => botKey.bot === bot)}>
            {bot === "runner" && <RunnerSettingsForm settings={builder} />}
          </BotCard>
        ))}
      </div>
    </>
  );
}
