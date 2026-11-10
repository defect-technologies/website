"use client";

import { AppWindow, Check, CircleNotch, DeviceMobile, Image, Layout, Palette, Quotes, Shapes, SkipForward, TextAa, type Icon } from "@phosphor-icons/react";
import type { AskTopic } from "@/lib/reviewAsks";
import KnifeStroke from "../KnifeStroke";
import type { AsksState } from "./useReviewAsks";
import type { AskAnswer, AskFlow } from "./useAskFlow";

const TOPIC_ICON: Record<AskTopic, Icon> = {
  "first-screen": AppWindow,
  type: TextAa,
  color: Palette,
  layout: Layout,
  copy: Quotes,
  imagery: Image,
  motif: Shapes,
  phone: DeviceMobile,
};

const ANSWER_MARK: Record<AskAnswer | "open" | "now", string> = {
  good: "bg-good",
  noted: "bg-vermilion",
  skipped: "bg-ink/20",
  open: "bg-ink/10",
  now: "bg-ink",
};

function Progress({ state, flow }: { state: AsksState; flow: AskFlow }) {
  return (
    <ol aria-label={`Question ${Math.min(flow.index + 1, state.asks.length)} of ${state.asks.length}`} className="flex items-center gap-1">
      {state.asks.map((ask, at) => (
        <li key={ask.id} className={`h-1.5 rounded-full transition-[width,background-color] duration-150 ${at === flow.index ? "w-5" : "w-1.5"} ${ANSWER_MARK[flow.answers[ask.id] ?? (at === flow.index ? "now" : "open")]}`} />
      ))}
    </ol>
  );
}

const CHOICE = "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-[background-color,scale] duration-150 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

function Writing() {
  return (
    <p className="text-ink-soft flex items-center gap-2 text-sm">
      <CircleNotch size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      Claude is reading this preview and writing questions
    </p>
  );
}

function Finished() {
  return (
    <p className="flex items-center gap-2 text-base font-medium">
      <KnifeStroke className="text-good h-3.5 w-10 shrink-0" />
      That was every question
    </p>
  );
}

type Props = { state: AsksState; flow: AskFlow; className?: string };

/**
 * One specific question about one part of the preview. Good and Skip move on; talking or typing answers it, and the
 * answer becomes a note on the element the question is about.
 */
export default function AskCard({ state, flow, className = "" }: Props) {
  if (state.status === "none") return null;
  const ask = flow.current;
  const TopicIcon = ask ? TOPIC_ICON[ask.topic] : AppWindow;
  return (
    <section aria-label="Question about this preview" aria-live="polite" className={`flex flex-col gap-2.5 ${className}`}>
      {state.status === "loading" && <Writing />}
      {state.status === "ready" && flow.finished && <Finished />}
      {ask && (
        <>
          <div className="flex items-start gap-2.5">
            <TopicIcon size={20} aria-hidden="true" className="text-ink-soft mt-0.5 shrink-0" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-base font-medium text-pretty">{ask.question}</p>
              {ask.why && <p className="text-ink-soft text-sm text-pretty">{ask.why}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={flow.good} className={`${CHOICE} bg-paper-shade text-ink hover:bg-paper-shade/70`}>
              <Check size={16} weight="bold" aria-hidden="true" />
              Good
            </button>
            <button type="button" onClick={flow.skip} className={`${CHOICE} text-ink-soft hover:bg-paper-shade`}>
              <SkipForward size={16} aria-hidden="true" />
              Skip
            </button>
            <span className="ml-auto">
              <Progress state={state} flow={flow} />
            </span>
          </div>
        </>
      )}
    </section>
  );
}
