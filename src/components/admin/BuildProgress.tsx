import { stepParts } from "@/lib/buildStatus";
import type { Eta } from "@/lib/buildStatus";

const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
const day = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });

/** A time today reads as "3:40 PM"; anything later carries its day. */
export function clockTime(date: Date, now: number) {
  return date.getTime() - now < 18 * 3600_000 ? clock.format(date) : day.format(date);
}

export function minutesText(minutes: number) {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** The builder's steps as segments: done ones filled, the current one pulsing. */
export function StepBar({ step, size = "md" }: { step: string; size?: "sm" | "md" }) {
  const { done, total } = stepParts(step);
  const height = size === "sm" ? "h-1.5" : "h-2.5";
  return (
    <div className="flex gap-1" role="img" aria-label={`Step ${done || 1} of ${total}`}>
      {Array.from({ length: total }, (_, index) => {
        const state = index < done - 1 ? "bg-ink" : index === Math.max(done, 1) - 1 ? "bg-vermilion motion-safe:animate-pulse" : "bg-ink/12";
        return <span key={index} className={`${height} flex-1 rounded-full ${state}`} />;
      })}
    </div>
  );
}

/** Where a build is and when it should finish. */
export default function BuildProgress({ step, eta, now }: { step: string; eta: Eta; now: number }) {
  const { done, total, words } = stepParts(step);
  const elapsed = (now - eta.startedAt.getTime()) / 60_000;
  return (
    <div className="flex flex-col gap-2">
      <StepBar step={step} />
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <span>
          <span className="font-semibold tabular-nums">
            {done || 1}/{total}
          </span>{" "}
          {words}
        </span>
        <span className="text-ink-soft tabular-nums">
          {minutesText(elapsed)} in,{" "}
          {eta.late ? <span className="text-warn font-medium">running long</span> : <span className="text-ink font-medium">done around {clockTime(eta.doneAt, now)}</span>}
        </span>
      </div>
    </div>
  );
}
