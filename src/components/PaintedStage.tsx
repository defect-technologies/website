"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CONVERSATION, SPEAKER_LABEL, WORDMARK, type ConversationLine } from "@/content/headlines";
import { useMotionAllowed } from "@/hooks/useMotionAllowed";
import { SCROLL_LENGTH, WORDMARK_SCRAPED_AT, lineThreshold, stageProgress } from "@/lib/choreography";
import KnifeCanvas from "./KnifeCanvas";
import PaintedHeadline from "./PaintedHeadline";

type StageState = { wordmarkShown: boolean; linesShown: number };

const AT_REST: StageState = { wordmarkShown: true, linesShown: 0 };
const EVERYTHING: StageState = { wordmarkShown: true, linesShown: CONVERSATION.length };

function stateAt(progress: number): StageState {
  return {
    wordmarkShown: progress < WORDMARK_SCRAPED_AT,
    linesShown: CONVERSATION.filter((_, index) => progress >= lineThreshold(index)).length,
  };
}

function sameState(a: StageState, b: StageState) {
  return a.wordmarkShown === b.wordmarkShown && a.linesShown === b.linesShown;
}

/** Re-renders only when scrolling crosses a threshold, not on every frame. */
function useStageState(container: React.RefObject<HTMLElement | null>, active: boolean) {
  const [state, setState] = useState(AT_REST);

  useEffect(() => {
    const element = container.current;
    if (!active || !element) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const next = stateAt(stageProgress(element));
      setState((current) => (sameState(current, next) ? current : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [container, active]);

  return state;
}

function lineStyle(line: ConversationLine): CSSProperties {
  return { fontSize: `calc(var(--line-size) * ${line.scale})` };
}

function Conversation({ linesShown }: { linesShown: number }) {
  return (
    <ol className="flex w-[min(84vw,52rem)] flex-col gap-[0.2em]">
      {CONVERSATION.map((line, index) => (
        <li key={line.id} className={line.speaker === "studio" ? "self-start" : "self-end"}>
          <span className="sr-only">{SPEAKER_LABEL[line.speaker]}: </span>
          <PaintedHeadline as="span" headline={line} shown={index < linesShown} style={lineStyle(line)} />
        </li>
      ))}
    </ol>
  );
}

const WORDMARK_SIZE: CSSProperties = { fontSize: "clamp(4rem, 21vw, 12rem)" };

/** The whole conversation at once, for readers who asked for less motion. */
function StillStage() {
  return (
    <section className="flex flex-col items-center gap-[14vh] px-4 py-[16vh]">
      <PaintedHeadline as="h1" headline={WORDMARK} shown={EVERYTHING.wordmarkShown} style={WORDMARK_SIZE} />
      <Conversation linesShown={EVERYTHING.linesShown} />
    </section>
  );
}

function ScrollCue({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="bg-ink/15 absolute bottom-[8vh] left-1/2 z-20 h-16 w-px -translate-x-1/2 overflow-hidden transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <span className="animate-trickle bg-ink/70 absolute inset-x-0 top-0 block h-5" />
    </div>
  );
}

function PaintHint({ visible }: { visible: boolean }) {
  return (
    <p
      className="text-ink-soft pointer-coarse:hidden absolute bottom-[5vh] left-1/2 z-20 -translate-x-1/2 text-sm transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      Drag anywhere to paint
    </p>
  );
}

export default function PaintedStage() {
  const container = useRef<HTMLDivElement>(null);
  const animate = useMotionAllowed();
  const { wordmarkShown, linesShown } = useStageState(container, animate);

  if (!animate) return <StillStage />;

  return (
    <div ref={container} style={{ height: SCROLL_LENGTH }}>
      <div className="sticky top-0 h-svh overflow-hidden">
        <KnifeCanvas className="absolute inset-0 size-full" />
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center pb-[2vh]">
          <PaintedHeadline as="h1" headline={WORDMARK} shown={wordmarkShown} style={WORDMARK_SIZE} />
        </div>
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <Conversation linesShown={linesShown} />
        </div>
        <ScrollCue visible={wordmarkShown} />
        <PaintHint visible={linesShown === CONVERSATION.length} />
      </div>
    </div>
  );
}
