import Link from "next/link";
import { BOT_LABEL } from "@/lib/bots";
import type { AgentState, RunnerDay } from "@/server/overview";
import { BuildsToday, PausedNotice } from "../RunnerControls";
import { When } from "../ui";
import WorkingDot from "./WorkingDot";

const RECENT_CALL_MS = 5 * 60 * 1000;

type Presence = "working" | "idle" | "missing";

function presenceOf(agent: AgentState, now: number): Presence {
  if (agent.building.length > 0) return "working";
  if (agent.keys.length === 0) return "missing";
  return agent.lastCallAt && now - agent.lastCallAt.getTime() < RECENT_CALL_MS ? "working" : "idle";
}

const PRESENCE_LABEL: Record<Presence, string> = { working: "Working now", idle: "Idle", missing: "No key yet" };

function PresenceMark({ presence }: { presence: Presence }) {
  if (presence === "working") return <WorkingDot />;
  const ring = presence === "idle" ? "border-ink-faint" : "border-ink-faint/60 border-dashed";
  return <span aria-hidden="true" className={`size-2.5 rounded-full border-[1.5px] ${ring}`} />;
}

function lastCheckIn(agent: AgentState) {
  return agent.keys.reduce<Date | null>((latest, key) => (key.lastHeartbeatAt && (!latest || key.lastHeartbeatAt > latest) ? key.lastHeartbeatAt : latest), null);
}

function Builds({ agent }: { agent: AgentState }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {agent.building.map((job) => (
        <li key={job.id} className="flex flex-col">
          <Link href={`/admin/pipeline/${job.businessId}`} className="font-medium hover:underline">
            Building {job.businessName}
          </Link>
          <span className="text-ink-soft line-clamp-2">{job.step || "Starting up"}</span>
          <span className="text-ink-faint">
            {job.runnerName}, started <When date={job.startedAt ?? job.claimedAt} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function LastAction({ agent }: { agent: AgentState }) {
  const action = agent.lastAction;
  if (!action) return <p className="text-ink-faint">Hasn&apos;t done anything yet</p>;
  return (
    <p className="flex flex-col">
      {action.businessName && <span className="font-medium">{action.businessName}</span>}
      <span className="text-ink-soft line-clamp-2" title={action.detail || undefined}>
        {action.detail ? `${action.action}: ${action.detail}` : action.action}
      </span>
      <span className="text-ink-faint">
        <When date={action.at} />
      </span>
    </p>
  );
}

function AgentCard({ agent, now, runner }: { agent: AgentState; now: number; runner?: RunnerDay }) {
  const presence = presenceOf(agent, now);
  const checkIn = lastCheckIn(agent);
  const working = presence === "working";
  return (
    <li className={`flex flex-col gap-1.5 p-4 text-sm sm:bg-surface sm:shadow-card sm:gap-2.5 sm:rounded-2xl ${working ? "sm:ring-vermilion/35 sm:ring-1" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 sm:flex-col sm:justify-start">
        <h3 className="text-base font-semibold">{BOT_LABEL[agent.bot]}</h3>
        <span className={`inline-flex items-center gap-1.5 ${working ? "text-ink" : "text-ink-faint"}`}>
          <PresenceMark presence={presence} />
          {PRESENCE_LABEL[presence]}
        </span>
      </div>
      {agent.building.length > 0 ? <Builds agent={agent} /> : <LastAction agent={agent} />}
      {runner && <BuildsToday day={runner} />}
      {runner?.pausedUntil && <PausedNotice until={runner.pausedUntil} />}
      {checkIn && (
        <p className="text-ink-faint mt-auto max-sm:hidden">
          Checked in <When date={checkIn} />
        </p>
      )}
    </li>
  );
}

/** What each bot and the preview runner is doing, or last did. */
export default function AgentStrip({ agents, now, runner }: { agents: AgentState[]; now: number; runner: RunnerDay }) {
  return (
    <section aria-labelledby="agents-heading" className="flex flex-col gap-3">
      <h2 id="agents-heading" className="sr-only">
        Agents
      </h2>
      <ul className="bg-surface shadow-card divide-ink/8 grid divide-y rounded-2xl sm:gap-3 sm:divide-y-0 sm:bg-transparent sm:shadow-none sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {agents.map((agent) => (
          <AgentCard key={agent.bot} agent={agent} now={now} runner={agent.bot === "runner" ? runner : undefined} />
        ))}
      </ul>
    </section>
  );
}
