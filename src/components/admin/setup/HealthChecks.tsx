import type { Icon } from "@phosphor-icons/react";
import { CheckCircle, CircleDashed, Clock, PauseCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import IntegrationPanel from "@/components/admin/IntegrationPanel";
import { Card, SectionHeading, When } from "@/components/admin/ui";
import type { healthChecks, CheckStatus, HealthCheck } from "@/server/integrations/healthchecks";

const STATUS: Record<CheckStatus, { icon: Icon; label: string; className: string }> = {
  up: { icon: CheckCircle, label: "Up", className: "text-good" },
  down: { icon: WarningCircle, label: "Down", className: "text-bad" },
  grace: { icon: Clock, label: "Late", className: "text-warn" },
  new: { icon: CircleDashed, label: "No ping yet", className: "text-ink-faint" },
  paused: { icon: PauseCircle, label: "Paused", className: "text-ink-faint" },
};

function CheckRow({ check }: { check: HealthCheck }) {
  const status = STATUS[check.status];
  const StatusIcon = status.icon;
  return (
    <li className="flex items-center gap-3">
      <StatusIcon size={20} weight="fill" className={`shrink-0 ${status.className}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate font-medium">{check.name}</span>
      <span className={`text-sm ${status.className}`}>{status.label}</span>
      <span className="text-ink-faint w-28 text-right text-sm">
        <When date={check.lastPing} />
      </span>
    </li>
  );
}

function Checks({ checks }: { checks: HealthCheck[] }) {
  if (checks.length === 0) return <p className="text-ink-soft text-sm">No checks yet</p>;
  return (
    <ul className="flex flex-col gap-2">
      {checks.map((check) => (
        <CheckRow key={check.key} check={check} />
      ))}
    </ul>
  );
}

/** Whether each scheduled job has pinged its health check on time. */
export default function HealthChecks({ result }: { result: Awaited<ReturnType<typeof healthChecks>> }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <SectionHeading>Health checks</SectionHeading>
      <IntegrationPanel result={result}>{(data) => <Checks checks={data} />}</IntegrationPanel>
    </Card>
  );
}
