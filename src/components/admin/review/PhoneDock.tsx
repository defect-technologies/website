"use client";

import { Check, CircleNotch, Crosshair, Microphone, PaperPlaneTilt, Stop } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { AUTO_SEND_SECONDS } from "@/lib/review";

type Props = {
  pointing: boolean;
  canPoint: boolean;
  onPoint: () => void;
  talk: { supported: boolean; listening: boolean; onToggle: () => void };
  spoken: string;
  splitting: boolean;
  problem: string;
  count: number;
  pending: boolean;
  armed: boolean;
  onSubmit: () => void;
};

/** Seconds left before onFire runs, counting only while armed. */
function useCountdown(armed: boolean, onFire: () => void) {
  const [left, setLeft] = useState(AUTO_SEND_SECONDS);
  const fire = useRef(onFire);
  useEffect(() => {
    fire.current = onFire;
  });
  useEffect(() => {
    if (!armed) return;
    const started = Date.now();
    const timer = setInterval(() => {
      const remaining = AUTO_SEND_SECONDS - Math.floor((Date.now() - started) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining > 0) return;
      clearInterval(timer);
      fire.current();
    }, 250);
    return () => {
      clearInterval(timer);
      setLeft(AUTO_SEND_SECONDS);
    };
  }, [armed]);
  return left;
}

function sendLabel(count: number, armed: boolean, left: number) {
  if (armed) return count ? `Sending in ${left}` : `Approving in ${left}`;
  if (count) return `Send ${count}`;
  return "Looks good";
}

function SendButton({ count, pending, armed, onSubmit }: Pick<Props, "count" | "pending" | "armed" | "onSubmit">) {
  const left = useCountdown(armed && !pending, onSubmit);
  const icon = pending ? <CircleNotch size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : count ? <PaperPlaneTilt size={20} aria-hidden="true" /> : <Check size={20} weight="bold" aria-hidden="true" />;
  return (
    <button
      type="button"
      data-send
      onClick={onSubmit}
      disabled={pending}
      aria-busy={pending}
      className="bg-ink text-paper relative inline-flex min-h-12 min-w-32 items-center justify-center overflow-hidden rounded-full px-4 text-base font-medium transition-[scale,opacity] duration-150 ease-knife active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-45"
    >
      {armed && !pending && <span aria-hidden="true" className="bg-paper/20 animate-countdown absolute inset-0 origin-left motion-reduce:animate-none" />}
      <span className="relative inline-flex items-center gap-2 tabular-nums">
        {icon}
        {sendLabel(count, armed, left)}
      </span>
    </button>
  );
}

function MicButton({ talk, splitting }: { talk: Props["talk"]; splitting: boolean }) {
  if (!talk.supported) return <span className="size-16" aria-hidden="true" />;
  return (
    <button
      type="button"
      onClick={talk.onToggle}
      disabled={splitting}
      aria-pressed={talk.listening}
      className={`bg-ink text-paper grid size-16 place-items-center rounded-full transition-[scale,opacity] duration-150 ease-knife active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-45 ${talk.listening ? "animate-listening motion-reduce:animate-none" : ""}`}
    >
      {talk.listening ? <Stop size={26} weight="fill" aria-hidden="true" /> : <Microphone size={28} weight="fill" aria-hidden="true" />}
      <span className="sr-only">{talk.listening ? "Done talking" : "Talk about this preview"}</span>
    </button>
  );
}

function PointButton({ pointing, canPoint, onPoint }: Pick<Props, "pointing" | "canPoint" | "onPoint">) {
  return (
    <button
      type="button"
      onClick={onPoint}
      disabled={!canPoint}
      aria-pressed={pointing}
      className={`flex min-h-12 min-w-20 flex-col items-center justify-center gap-0.5 rounded-2xl text-sm font-medium transition-[color,background-color,opacity] duration-150 focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-35 ${pointing ? "bg-ink text-paper shadow-pointing" : "text-ink-soft"}`}
    >
      <Crosshair size={22} weight={pointing ? "bold" : "regular"} aria-hidden="true" />
      Point
    </button>
  );
}

function SpokenBubble({ spoken, listening, splitting, problem }: { spoken: string; listening: boolean; splitting: boolean; problem: string }) {
  if (problem) {
    return (
      <p role="alert" className="text-bad px-1 text-sm font-medium text-pretty">
        {problem}
      </p>
    );
  }
  if (!listening && !splitting) return null;
  return (
    <p className="flex items-start gap-2 px-1 text-base text-pretty">
      {splitting && <CircleNotch size={18} className="text-ink-soft mt-0.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      <span className={spoken ? "text-ink" : "text-ink-faint"}>{spoken || "Listening. Say what's wrong, then tap the mic again."}</span>
    </p>
  );
}

/**
 * The review page's controls on a phone, within thumb reach: point at a part of the preview, talk, and send.
 * Notes split from speech send themselves after a countdown that any touch stops.
 */
export default function PhoneDock({ pointing, canPoint, onPoint, talk, spoken, splitting, problem, count, pending, armed, onSubmit }: Props) {
  return (
    <div className="bg-paper/95 shadow-lifted fixed inset-x-0 bottom-0 z-30 flex flex-col gap-3 rounded-t-3xl px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
      <div aria-live="polite">
        <SpokenBubble spoken={spoken} listening={talk.listening} splitting={splitting} problem={problem} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <PointButton pointing={pointing} canPoint={canPoint} onPoint={onPoint} />
        <MicButton talk={talk} splitting={splitting} />
        <SendButton count={count} pending={pending} armed={armed} onSubmit={onSubmit} />
      </div>
    </div>
  );
}
