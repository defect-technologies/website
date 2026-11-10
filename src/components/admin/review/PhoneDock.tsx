"use client";

import { Check, CircleNotch, Crosshair, Keyboard, Microphone, PaperPlaneTilt, Plus, Stop } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { AUTO_SEND_SECONDS } from "@/lib/review";

type Typing = { text: string; onChange: (text: string) => void; onAdd: () => void };

type Props = {
  pointing: boolean;
  onPoint: () => void;
  typing: Typing;
  talk: { supported: boolean; listening: boolean; onToggle: () => void };
  spoken: string;
  splitting: boolean;
  notice: { text: string; bad: boolean } | null;
  count: number;
  pending: boolean;
  armed: boolean;
  onSubmit: () => void;
  /** The open question about the preview, shown above the controls. */
  ask: ReactNode;
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
  return "Approve";
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
      className="bg-ink text-paper shadow-lifted relative inline-flex min-h-14 min-w-28 items-center justify-center overflow-hidden rounded-full px-4 text-base font-medium transition-[scale,opacity] duration-150 ease-knife active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-45"
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
      className={`bg-ink text-paper shadow-lifted grid size-16 place-items-center rounded-full transition-[scale,opacity] duration-150 ease-knife active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-45 ${talk.listening ? "animate-listening motion-reduce:animate-none" : ""}`}
    >
      {talk.listening ? <Stop size={26} weight="fill" aria-hidden="true" /> : <Microphone size={28} weight="fill" aria-hidden="true" />}
      <span className="sr-only">{talk.listening ? "Done talking" : "Talk about this preview"}</span>
    </button>
  );
}

const SIDE_BUTTON =
  "shadow-lifted flex min-h-14 min-w-14 flex-col items-center justify-center gap-0.5 rounded-full px-3 text-xs font-medium backdrop-blur transition-[color,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-ink";

function SideButton({ label, on, onClick, children }: { label: string; on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`${SIDE_BUTTON} ${on ? "bg-ink text-paper shadow-pointing" : "bg-paper/95 text-ink"}`}>
      {children}
      {label}
    </button>
  );
}

/** A text field above the controls for typing a note instead of saying it. Enter or Add keeps it. */
function TypeField({ typing, onDone }: { typing: Typing; onDone: () => void }) {
  const add = () => {
    if (!typing.text.trim()) return;
    typing.onAdd();
    onDone();
  };
  return (
    <div className={`${CARD} flex items-end gap-2`}>
      <label htmlFor="phone-note" className="sr-only">
        Type a note
      </label>
      <textarea
        id="phone-note"
        autoFocus
        rows={2}
        value={typing.text}
        onChange={(event) => typing.onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          event.preventDefault();
          add();
        }}
        placeholder="What should change?"
        className="bg-surface border-ink/15 placeholder:text-ink-faint focus-visible:border-ink min-w-0 flex-1 resize-none rounded-lg border px-3 py-2 text-base focus-visible:outline-none"
      />
      <button type="button" onClick={add} disabled={!typing.text.trim()} className="bg-ink text-paper grid size-11 shrink-0 place-items-center rounded-full disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        <Plus size={18} weight="bold" aria-hidden="true" />
        <span className="sr-only">Add note</span>
      </button>
    </div>
  );
}

/** The floating surface for anything shown above the dock's buttons. */
export const CARD = "bg-paper/95 shadow-lifted pointer-events-auto rounded-2xl px-4 py-3 text-pretty backdrop-blur";

function SpokenBubble({ spoken, listening, splitting, notice }: { spoken: string; listening: boolean; splitting: boolean; notice: Props["notice"] }) {
  if (notice) {
    return (
      <p role={notice.bad ? "alert" : "status"} className={`${CARD} text-sm font-medium ${notice.bad ? "text-bad" : "text-ink"}`}>
        {notice.text}
      </p>
    );
  }
  if (!listening && !splitting) return null;
  return (
    <p className={`${CARD} flex items-start gap-2 text-base`}>
      {splitting && <CircleNotch size={18} className="text-ink-soft mt-0.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      <span className={spoken ? "text-ink" : "text-ink-faint"}>{spoken || "Listening. Say what's wrong, then tap the mic again."}</span>
    </p>
  );
}

/**
 * The review page's controls on a phone, within thumb reach: point at a part of the preview, talk, and send.
 * Notes split from speech send themselves after a countdown that any touch stops.
 */
export default function PhoneDock({ pointing, onPoint, typing, talk, spoken, splitting, notice, count, pending, armed, onSubmit, ask }: Props) {
  const [typingOpen, setTypingOpen] = useState(false);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      {ask}
      {typingOpen && <TypeField typing={typing} onDone={() => setTypingOpen(false)} />}
      <div aria-live="polite" className="empty:hidden">
        <SpokenBubble spoken={spoken} listening={talk.listening} splitting={splitting} notice={notice} />
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        <SideButton label="Point" on={pointing} onClick={onPoint}>
          <Crosshair size={22} weight={pointing ? "bold" : "regular"} aria-hidden="true" />
        </SideButton>
        <SideButton label="Type" on={typingOpen} onClick={() => setTypingOpen((open) => !open)}>
          <Keyboard size={22} aria-hidden="true" />
        </SideButton>
        <span className="flex flex-1 justify-center">
          <MicButton talk={talk} splitting={splitting} />
        </span>
        <SendButton count={count} pending={pending} armed={armed} onSubmit={onSubmit} />
      </div>
    </div>
  );
}
