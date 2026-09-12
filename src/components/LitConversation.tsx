"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  glow,
  lampPower,
  paperOpacity,
  scrollProgress,
} from "@/lib/choreography";
import { RoomRenderer, type LampUniform } from "@/lib/renderer";
import { CONVERSATION, SPEAKER_LABEL, cssColor } from "@/lib/scene";

const RENDER_SCALE = 0.62;

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
  return Math.min(window.devicePixelRatio || 1, 2) * RENDER_SCALE;
}

function measureLamp(line: HTMLElement, quality: number): LampUniform | null {
  const index = Number(line.dataset.line);
  const lamp = CONVERSATION[index];
  if (!lamp) return null;

  const box = line.getBoundingClientRect();
  const middle = box.top + box.height / 2;
  const power = lampPower(middle / window.innerHeight);

  line.style.opacity = (0.05 + 0.95 * power).toFixed(3);
  line.style.textShadow = glow(lamp.rgb, power);

  return {
    left: box.left * quality,
    right: box.right * quality,
    centre: (window.innerHeight - middle) * quality,
    halfHeight: box.height * 0.32 * quality,
    rgb: lamp.rgb,
    power: power * lamp.power,
  };
}

export default function LitConversation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLElement[]>([]);
  const animated = useMotionAllowed();

  useEffect(() => {
    if (!animated) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = RoomRenderer.create(canvas);
    let quality = deviceQuality();
    let frame = 0;

    const fit = () => {
      quality = deviceQuality();
      canvas.width = Math.round(window.innerWidth * quality);
      canvas.height = Math.round(window.innerHeight * quality);
      renderer?.resize(canvas.width, canvas.height);
    };

    const tick = (now: number) => {
      const progress = scrollProgress();
      const paper = paperOpacity(progress);
      if (paperRef.current) paperRef.current.style.opacity = paper.toFixed(3);
      if (markRef.current) markRef.current.style.opacity = (1 - paper).toFixed(3);
      if (cueRef.current) {
        cueRef.current.style.opacity = Math.max(0, 1 - progress / 0.018).toFixed(3);
      }

      const lamps = linesRef.current
        .map((line) => measureLamp(line, quality))
        .filter((lamp): lamp is LampUniform => lamp !== null);

      renderer?.draw(lamps, now / 1000);
      frame = requestAnimationFrame(tick);
    };

    fit();
    window.addEventListener("resize", fit);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", fit);
    };
  }, [animated]);

  return (
    <>
      {animated && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 h-full w-full"
        />
      )}

      <div className="relative z-20">
        <section className="flex h-screen flex-col items-center justify-center">
          <h1 className="font-display text-ink text-[clamp(3.5rem,13vw,9rem)] leading-none font-extrabold">
            defect.tech
          </h1>
          {animated && (
            <div
              ref={cueRef}
              aria-hidden="true"
              className="absolute bottom-[12vh] h-16 w-px overflow-hidden bg-ink/15"
            >
              <span className="animate-trickle bg-ink/70 absolute inset-x-0 top-0 block h-5" />
            </div>
          )}
        </section>

        <ol>
          {CONVERSATION.map((lamp, index) => (
            <li
              key={lamp.text}
              className={`flex h-screen items-center px-[6vw] ${
                lamp.speaker === "studio" ? "justify-start" : "justify-end"
              }`}
            >
              <p>
                <span className="sr-only">{SPEAKER_LABEL[lamp.speaker]}: </span>
                <span
                  data-line={index}
                  ref={(node) => {
                    if (node) linesRef.current[index] = node;
                  }}
                  className={`font-display block max-w-[86vw] text-balance leading-[0.86] font-extrabold sm:max-w-[62vw] ${
                    lamp.speaker === "studio" ? "text-left" : "text-right"
                  }`}
                  style={{
                    fontSize: `calc(var(--line-size) * ${lamp.scale})`,
                    color: cssColor(lamp.rgb),
                    textShadow: glow(lamp.rgb, 1),
                  }}
                >
                  {lamp.text}
                </span>
              </p>
            </li>
          ))}
        </ol>

        <div className="h-[70vh]" />
      </div>

      {animated && (
        <>
          <div
            ref={paperRef}
            aria-hidden="true"
            className="bg-paper pointer-events-none fixed inset-0 z-10"
          />
          <div
            ref={markRef}
            aria-hidden="true"
            className="font-body fixed top-[3vh] left-[6vw] z-30 text-sm text-white/35 opacity-0"
          >
            defect.tech
          </div>
        </>
      )}
    </>
  );
}
