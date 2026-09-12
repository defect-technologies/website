"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  glow,
  lampPower,
  paperOpacity,
  scrollProgress,
} from "@/lib/choreography";
import { RoomRenderer, type LampUniform } from "@/lib/renderer";
import {
  CONVERSATION,
  SCROLL_LENGTH,
  SPEAKER_LABEL,
  cssColor,
  type Lamp,
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
  return `font-display block max-w-[88vw] text-balance uppercase leading-[0.82] font-black ${
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

function measureLamp(
  line: HTMLElement,
  quality: number,
  progress: number,
): LampUniform | null {
  const index = Number(line.dataset.line);
  const lamp = CONVERSATION[index];
  if (!lamp) return null;

  const power = lampPower(progress, index, CONVERSATION.length);
  // Not there at all until it switches on.
  line.style.opacity = power.toFixed(3);
  line.style.textShadow = glow(lamp.rgb, power);

  // Light lags the glyph: the words show up first, then the room catches up.
  const emission = Math.pow(power, 2.2);

  const box = line.getBoundingClientRect();
  return {
    left: box.left * quality,
    right: box.right * quality,
    centre: (window.innerHeight - (box.top + box.height / 2)) * quality,
    halfHeight: box.height * 0.32 * quality,
    rgb: lamp.rgb,
    power: emission * lamp.power,
  };
}

/** The whole conversation at rest: no canvas, no scroll choreography. */
function StillConversation() {
  return (
    <div className="px-[6vw] py-[12vh]">
      <h1 className="font-script text-paper text-[clamp(3rem,14vw,9rem)] leading-[1.25]">
        defect.tech
      </h1>
      <ol className="mt-[10vh] space-y-[7vh]">
        {CONVERSATION.map((lamp) => (
          <li
            key={lamp.text}
            className={lamp.speaker === "studio" ? "text-left" : "text-right"}
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
  const animated = useMotionAllowed();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!animated || !canvas) return;

    const renderer = RoomRenderer.create(canvas);
    let quality = deviceQuality();
    let frame = 0;
    let lastProgress = -1;
    let dirty = true;

    const fit = () => {
      quality = deviceQuality();
      canvas.width = Math.round(window.innerWidth * quality);
      canvas.height = Math.round(window.innerHeight * quality);
      renderer?.resize(canvas.width, canvas.height);
      dirty = true;
    };

    const paint = (progress: number) => {
      const paper = paperOpacity(progress);
      if (paperRef.current) paperRef.current.style.opacity = paper.toFixed(3);
      if (titleRef.current) titleRef.current.style.opacity = paper.toFixed(3);
      if (markRef.current) markRef.current.style.opacity = (1 - paper).toFixed(3);
      if (cueRef.current) {
        const fade = Math.max(0, 1 - progress / 0.02);
        cueRef.current.style.opacity = (paper * fade).toFixed(3);
      }
    };

    // The room only changes when the scroll does. Sitting still costs one
    // comparison per frame instead of a full-screen shader pass, which is the
    // difference between idling at zero and pinning a GPU forever.
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const progress = scrollProgress();
      if (!dirty && progress === lastProgress) return;
      lastProgress = progress;
      dirty = false;

      paint(progress);
      const lamps = linesRef.current
        .map((line) => measureLamp(line, quality, progress))
        .filter((lamp): lamp is LampUniform => lamp !== null);
      renderer?.draw(lamps);
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

        <ol className="absolute inset-0 z-10">
          {CONVERSATION.map((lamp, index) => (
            <li
              key={lamp.text}
              className={`absolute flex w-full px-[6vw] ${
                lamp.speaker === "studio" ? "justify-start" : "justify-end"
              }`}
              style={{ top: `${lamp.top * 100}%` }}
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
        </ol>

        <div
          ref={paperRef}
          aria-hidden="true"
          className="bg-paper pointer-events-none absolute inset-0 z-20"
        />

        <h1
          ref={titleRef}
          className="font-script text-ink absolute inset-0 z-30 flex items-center justify-center pb-[2vh] text-[clamp(4.5rem,20vw,17rem)] leading-[1.25]"
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
