"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Day } from "@/lib/siteAnalytics";

const WIDTH = 600;
const HEIGHT = 160;
const TOP = 12;

const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const axisLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const asDate = (date: string) => new Date(`${date}T00:00:00Z`);
const plural = (count: number, one: string, many: string) => `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;

function points(days: Day[]) {
  const peak = Math.max(1, ...days.map((day) => day.visitors));
  const step = days.length > 1 ? WIDTH / (days.length - 1) : 0;
  return days.map((day, index) => ({ x: index * step, y: TOP + (HEIGHT - TOP) * (1 - day.visitors / peak) }));
}

function paths(days: Day[]) {
  const coords = points(days);
  const line = coords.map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return { coords, line, area: `${line} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z` };
}

const KEY_STEP: Record<string, (index: number, last: number) => number> = {
  ArrowLeft: (index) => Math.max(0, index - 1),
  ArrowRight: (index, last) => Math.min(last, index + 1),
  Home: () => 0,
  End: (_index, last) => last,
};

/** Visitors per day. Point at it, or focus it and use the arrow keys, to read any day. */
export default function VisitorsChart({ days }: { days: Day[] }) {
  const [active, setActive] = useState<number | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const { coords, line, area } = paths(days);
  const last = days.length - 1;
  const shown = active === null ? null : { day: days[active], at: coords[active] };

  function pick(event: PointerEvent<HTMLDivElement>) {
    const box = frame.current?.getBoundingClientRect();
    if (!box || last < 0) return;
    setActive(Math.round(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * last));
  }

  function step(event: KeyboardEvent<HTMLDivElement>) {
    const move = KEY_STEP[event.key];
    if (!move) return;
    event.preventDefault();
    setActive(move(active ?? last, last));
  }

  const peak = Math.max(0, ...days.map((day) => day.visitors));
  const middle = days[Math.floor(last / 2)];
  const axis = (
    <div aria-hidden="true" className="text-ink-faint flex justify-between text-xs">
      <span>{days[0] && axisLabel.format(asDate(days[0].date))}</span>
      <span>{middle && axisLabel.format(asDate(middle.date))}</span>
      <span>{days[last] && axisLabel.format(asDate(days[last].date))}</span>
    </div>
  );
  if (peak === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="border-ink/15 flex h-44 items-center justify-center border-b">
          <p className="text-ink-faint">No visits yet</p>
        </div>
        {axis}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div
        ref={frame}
        tabIndex={0}
        role="group"
        aria-label="Visitors per day. Use the left and right arrow keys to read each day."
        onPointerMove={pick}
        onPointerLeave={() => setActive(null)}
        onKeyDown={step}
        onBlur={() => setActive(null)}
        className="relative h-44 touch-pan-y rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
      >
        <span aria-hidden="true" className="text-ink-faint absolute top-0 left-0 text-xs tabular-nums">
          {peak.toLocaleString("en-US")}
        </span>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" className="h-full w-full overflow-visible">
          <line x1="0" x2={WIDTH} y1={HEIGHT} y2={HEIGHT} className="stroke-ink/15" vectorEffect="non-scaling-stroke" />
          <path d={area} className="fill-ink/6" />
          <path d={line} fill="none" className="stroke-ink" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {shown && <line x1={shown.at.x} x2={shown.at.x} y1={TOP} y2={HEIGHT} className="stroke-ink/25" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        </svg>
        {shown && (
          <>
            <span
              aria-hidden="true"
              className="bg-vermilion ring-paper pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
              style={{ left: `${(shown.at.x / WIDTH) * 100}%`, top: `${(shown.at.y / HEIGHT) * 100}%` }}
            />
            <div
              aria-hidden="true"
              className="bg-ink text-paper shadow-lifted pointer-events-none absolute -top-2 z-10 w-max -translate-y-full rounded-lg px-3 py-2 text-sm"
              style={{ left: `clamp(0px, calc(${(shown.at.x / WIDTH) * 100}% - 4.5rem), calc(100% - 9rem))` }}
            >
              <p className="font-semibold">{dayLabel.format(asDate(shown.day.date))}</p>
              <p className="tabular-nums">{plural(shown.day.visitors, "visitor", "visitors")}</p>
              <p className="text-paper/70 tabular-nums">{plural(shown.day.pageviews, "page view", "page views")}</p>
            </div>
          </>
        )}
      </div>
      {axis}
      <p role="status" className="sr-only">
        {shown ? `${dayLabel.format(asDate(shown.day.date))}: ${plural(shown.day.visitors, "visitor", "visitors")}, ${plural(shown.day.pageviews, "page view", "page views")}` : ""}
      </p>
    </div>
  );
}
