import { Play, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { resumeRunnerAction } from "@/app/admin/(panel)/setup/bots/actions";
import { BOT_LABEL } from "@/lib/bots";
import { stepParts } from "@/lib/buildStatus";
import type { RunnerStatus } from "@/server/runner/status";
import type { AgentState, RunnerDay } from "@/server/overview";
import SubmitButton from "../SubmitButton";
import { Card, StatusMark, timeAgo } from "../ui";
import WorkingDot from "./WorkingDot";

const RECENT_CALL_MS = 5 * 60 * 1000;

const pacific = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });

type Presence = "working" | "idle" | "missing";

function presenceOf(agent: AgentState, now: number): Presence {
  if (agent.building.length > 0) return "working";
  if (agent.keys.length === 0) return "missing";
  return agent.lastCallAt && now - agent.lastCallAt.getTime() < RECENT_CALL_MS ? "working" : "idle";
}

function PresenceMark({ presence }: { presence: Presence }) {
  if (presence === "working") return <WorkingDot />;
  const ring = presence === "idle" ? "border-ink-faint" : "border-ink-faint/60 border-dashed";
  return <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full border-[1.5px] ${ring}`} />;
}

const PRESENCE_LABEL: Record<Presence, string> = { working: "working", idle: "idle", missing: "has no key" };

function lastActionText(agent: AgentState) {
  const action = agent.lastAction;
  if (!action) return "Hasn't done anything yet";
  const what = action.detail ? `${action.action}: ${action.detail}` : action.action;
  return `${action.businessName ? `${action.businessName}. ` : ""}${what} (${timeAgo(action.at)})`;
}

function Bot({ agent, now }: { agent: AgentState; now: number }) {
  const presence = presenceOf(agent, now);
  const detail = lastActionText(agent);
  return (
    <li>
      <Link href="/admin/setup/bots" title={detail} className="hover:bg-paper-shade flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm">
        <PresenceMark presence={presence} />
        <span className={presence === "working" ? "text-ink font-medium" : "text-ink-soft"}>{BOT_LABEL[agent.bot]}</span>
        <span className="text-ink-faint tabular-nums">{agent.lastAction ? timeAgo(agent.lastAction.at, now) : ""}</span>
        <span className="sr-only">
          {PRESENCE_LABEL[presence]}. Last: {detail}
        </span>
      </Link>
    </li>
  );
}

function Runner({ builds, runner }: { builds: RunnerStatus; runner: RunnerDay }) {
  const now = builds.current[0];
  return (
    <li className="flex flex-wrap items-center gap-x-3">
      <Link href="/admin/builds" className="hover:bg-paper-shade flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm">
        <PresenceMark presence={now ? "working" : "idle"} />
        <span className={now ? "text-ink font-medium" : "text-ink-soft"}>Runner</span>
        <span className="text-ink-faint tabular-nums">
          {now ? `${now.businessName}, ${stepParts(now.step).done || 1}/${stepParts(now.step).total}` : "idle"}, {builds.queue.length} queued, {runner.built}/{runner.settings.dailyCap} today
        </span>
      </Link>
      {builds.abandoned.length > 0 && (
        <Link href="/admin/builds" className="rounded-xl px-1 hover:underline">
          <StatusMark icon={WarningCircle} tone="warn" label={`${builds.abandoned.length} abandoned`} detail={builds.abandoned.map((job) => job.businessName).join(", ")} />
        </Link>
      )}
    </li>
  );
}

function Paused({ until }: { until: Date }) {
  return (
    <li className="flex items-center gap-2">
      <StatusMark icon={WarningCircle} tone="warn" label={`Paused until ${pacific.format(until)}`} detail="Claude's usage limit was hit." />
      <form action={resumeRunnerAction}>
        <SubmitButton size="sm" variant="ghost" icon={<Play size={16} aria-hidden="true" />}>
          Resume
        </SubmitButton>
      </form>
    </li>
  );
}

/** Every bot and the preview runner on one line: who's working, and anything stuck. */
export default function AgentRow({ agents, now, runner, builds }: { agents: AgentState[]; now: number; runner: RunnerDay; builds: RunnerStatus }) {
  return (
    <Card className="px-2 py-1">
      <h2 className="sr-only">Bots</h2>
      <ul className="flex flex-wrap items-center">
        {agents
          .filter((agent) => agent.bot !== "runner")
          .map((agent) => (
            <Bot key={agent.bot} agent={agent} now={now} />
          ))}
        <Runner builds={builds} runner={runner} />
        {runner.pausedUntil && <Paused until={runner.pausedUntil} />}
      </ul>
    </Card>
  );
}
