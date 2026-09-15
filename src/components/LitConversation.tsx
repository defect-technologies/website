"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  BLACKOUT_AT,
  CLOSING_AT,
  FLICKER_MS,
  flicker,
  glow,
  lineThreshold,
  scrollProgress,
} from "@/lib/choreography";
import { RoomRenderer, type LampUniform } from "@/lib/renderer";
import {
  CLOSING_LINE,
  CLOSING_MARK,
  CONVERSATION,
  SCROLL_LENGTH,
  SPEAKER_LABEL,
  cssColor,
  type Lamp,
  type RGB,
} from "@/lib/scene";

const STILLNESS = "(prefers-reduced-motion: reduce)";

function watchStillness(onChange: () => void) {
  const query = window.matchMedia(STILLNESS);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** False on the server and whenever the reader asks for less motion. */
function useMotionAllowed() {
  return useSyncExternalStore(
    watchStillness,
    () => !window.matchMedia(STILLNESS).matches,
    () => false,
  );
}

function deviceQuality() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

function lineClass(lamp: Lamp) {
  // 0.92em against a measured 0.821em of ink. The margin has to be a fraction
  // of the em, not a few pixels, or it vanishes at phone type sizes.
  return `font-display block uppercase leading-[0.92] font-black ${
    lamp.speaker === "studio" ? "text-left" : "text-right"
  }`;
}

function lineStyle(lamp: Lamp) {
  return {
    fontSize: `calc(var(--line-size) * ${lamp.scale})`,
    color: cssColor(lamp.rgb),
    textShadow: glow(lamp.rgb, 1),
  };
}

/** A switch and the moment it was last thrown. */
type Gate = { target: 0 | 1; changedAt: number };

function drive(gate: Gate, desired: 0 | 1, now: number): number {
  if (gate.target !== desired) {
    gate.target = desired;
    gate.changedAt = now;
  }
  return flicker(gate.target, now - gate.changedAt);
}

function stillSwitching(gate: Gate, now: number) {
  return now - gate.changedAt < FLICKER_MS;
}

function paintText(el: HTMLElement, rgb: RGB, power: number) {
  el.style.opacity = power.toFixed(3);
  el.style.textShadow = glow(rgb, power);
}

function lampFrom(
  el: HTMLElement,
  rgb: RGB,
  configured: number,
  power: number,
  quality: number,
): LampUniform | null {
  if (power <= 0.002) return null;
  const box = el.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return null;
  return {
    left: box.left * quality,
    right: box.right * quality,
    centre: (window.innerHeight - (box.top + box.height / 2)) * quality,
    halfHeight: box.height * 0.32 * quality,
    rgb,
    power: power * configured,
  };
}

/** The whole page at rest: no canvas, no thresholds, everything simply lit. */
function StillConversation() {
  return (
    <div className="px-[6vw] py-[12vh]">
      <h1 className="font-script text-paper text-[clamp(2.5rem,9vw,6rem)] leading-[1.25]">
        defect.tech
      </h1>
      <ol className="mx-auto mt-[8vh] flex w-[min(62vw,48rem)] flex-col">
        {CONVERSATION.map((lamp) => (
          <li
            key={lamp.text}
            className={lamp.speaker === "studio" ? "self-start" : "self-end"}
          >
            <p>
              <span className="sr-only">{SPEAKER_LABEL[lamp.speaker]}: </span>
              <span className={lineClass(lamp)} style={lineStyle(lamp)}>
                {lamp.text}
              </span>
            </p>
          </li>
        ))}
      </ol>
      <p
        className="font-display mt-[10vh] text-[clamp(1.25rem,2.8vw,2.4rem)] leading-[1.1] font-semibold"
        style={{ color: cssColor(CLOSING_LINE.rgb) }}
      >
        {CLOSING_LINE.text}
      </p>
      <div
        className="font-script mt-[2vh] text-[clamp(2rem,5vw,4rem)] leading-[1.25]"
        style={{ color: cssColor(CLOSING_MARK.rgb) }}
      >
        {CLOSING_MARK.text}
      </div>
    </div>
  );
}

export default function LitConversation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLElement[]>([]);
  const closingLineRef = useRef<HTMLParagraphElement>(null);
  const closingMarkRef = useRef<HTMLDivElement>(null);
  const animated = useMotionAllowed();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!animated || !canvas) return;

    const renderer = RoomRenderer.create(canvas);
    let quality = deviceQuality();
    let frame = 0;
    let lastProgress = -1;
    let dirty = true;
    let wasSwitching = true;

    const opened = performance.now();
    const lit = CONVERSATION.map(() => false);
    const lineGates: Gate[] = CONVERSATION.map(() => ({ target: 0, changedAt: opened }));
    const paperGate: Gate = { target: 1, changedAt: opened };
    const closingGate: Gate = { target: 0, changedAt: opened };
    const allGates = () => [paperGate, closingGate, ...lineGates];

    const fit = () => {
      quality = deviceQuality();
      canvas.width = Math.round(window.innerWidth * quality);
      canvas.height = Math.round(window.innerHeight * quality);
      renderer?.resize(canvas.width, canvas.height);
      dirty = true;
    };

    const paintChrome = (progress: number, now: number) => {
      const paper = drive(paperGate, progress >= BLACKOUT_AT ? 0 : 1, now);
      if (paperRef.current) paperRef.current.style.opacity = paper.toFixed(3);
      if (titleRef.current) titleRef.current.style.opacity = paper.toFixed(3);
      if (markRef.current) markRef.current.style.opacity = (1 - paper).toFixed(3);
      if (cueRef.current) {
        const fade = Math.max(0, 1 - progress / 0.03);
        cueRef.current.style.opacity = (paper * fade).toFixed(3);
      }
    };

    const collectLamps = (closing: 0 | 1, now: number) => {
      const lamps: LampUniform[] = [];

      CONVERSATION.forEach((lamp, index) => {
        const el = linesRef.current[index];
        if (!el) return;
        const power = drive(lineGates[index], lit[index] && !closing ? 1 : 0, now);
        paintText(el, lamp.rgb, power);
        const uniform = lampFrom(el, lamp.rgb, lamp.power, power, quality);
        if (uniform) lamps.push(uniform);
      });

      const closingPower = drive(closingGate, closing, now);
      const tail: [HTMLElement | null, typeof CLOSING_LINE][] = [
        [closingLineRef.current, CLOSING_LINE],
        [closingMarkRef.current, CLOSING_MARK],
      ];
      tail.forEach(([el, config]) => {
        if (!el) return;
        paintText(el, config.rgb, closingPower);
        const uniform = lampFrom(el, config.rgb, config.power, closingPower, quality);
        if (uniform) lamps.push(uniform);
      });

      return lamps.sort((a, b) => b.power - a.power);
    };

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const now = performance.now();
      const progress = scrollProgress();
      const switching = allGates().some((gate) => stillSwitching(gate, now));
      // The frame a flicker finishes on still has to be painted, or the last
      // value written stays a mid-sequence one and the light freezes part-lit.
      const settling = wasSwitching && !switching;
      if (!dirty && !switching && !settling && progress === lastProgress) return;
      wasSwitching = switching;
      lastProgress = progress;
      dirty = false;

      CONVERSATION.forEach((_, index) => {
        if (progress >= lineThreshold(index)) lit[index] = true;
      });
      const closing: 0 | 1 = progress >= CLOSING_AT ? 1 : 0;

      paintChrome(progress, now);
      renderer?.draw(collectLamps(closing, now));
    };

    fit();
    window.addEventListener("resize", fit);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", fit);
    };
  }, [animated]);

  if (!animated) return <StillConversation />;

  return (
    <div style={{ height: SCROLL_LENGTH }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        <ol className="absolute inset-0 z-10 flex flex-col items-center justify-center">
          <div className="flex w-[min(62vw,48rem)] flex-col">
            {CONVERSATION.map((lamp, index) => (
              <li
                key={lamp.text}
                className={lamp.speaker === "studio" ? "self-start" : "self-end"}
              >
                <p>
                  <span className="sr-only">{SPEAKER_LABEL[lamp.speaker]}: </span>
                  <span
                    data-line={index}
                    ref={(node) => {
                      if (node) linesRef.current[index] = node;
                    }}
                    className={lineClass(lamp)}
                    style={lineStyle(lamp)}
                  >
                    {lamp.text}
                  </span>
                </p>
              </li>
            ))}
          </div>
        </ol>

        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-[4vh]">
          <p
            ref={closingLineRef}
            data-closing="line"
            className="font-display max-w-[86vw] text-center text-[clamp(1.25rem,2.8vw,2.4rem)] leading-[1.15] font-semibold opacity-0"
            style={{ color: cssColor(CLOSING_LINE.rgb) }}
          >
            {CLOSING_LINE.text}
          </p>
          <div
            ref={closingMarkRef}
            data-closing="mark"
            className="font-script text-[clamp(2rem,5vw,4rem)] leading-[1.25] opacity-0"
            style={{ color: cssColor(CLOSING_MARK.rgb) }}
          >
            {CLOSING_MARK.text}
          </div>
        </div>

        <div
          ref={paperRef}
          aria-hidden="true"
          className="bg-paper pointer-events-none absolute inset-0 z-20"
        />

        <h1
          ref={titleRef}
          className="font-script text-ink absolute inset-0 z-30 flex items-center justify-center pb-[2vh] text-[clamp(3rem,13vw,11rem)] leading-[1.25]"
        >
          defect.tech
        </h1>

        <div
          ref={markRef}
          aria-hidden="true"
          className="font-script absolute top-[3vh] left-[6vw] z-30 text-2xl leading-[1.4] text-white/45 opacity-0"
        >
          defect.tech
        </div>

        <div
          ref={cueRef}
          aria-hidden="true"
          className="bg-ink/15 absolute bottom-[8vh] left-1/2 z-30 h-16 w-px -translate-x-1/2 overflow-hidden"
        >
          <span className="animate-trickle bg-ink/70 absolute inset-x-0 top-0 block h-5" />
        </div>
      </div>
    </div>
  );
}
