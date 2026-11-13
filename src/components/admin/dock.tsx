"use client";

import { CircleNotch, Microphone, Plus, Stop } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { AUTO_SEND_SECONDS } from "@/lib/review";

// The controls a founder holds a phone by: a dock within thumb reach, with what it is about to do shown above it.
// The Review page and the Designs page are both worked from one.

/** The floating surface for anything shown above a dock's buttons. */
export const DOCK_CARD = "bg-paper/95 shadow-lifted pointer-events-auto rounded-2xl px-4 py-3 text-pretty backdrop-blur";

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

const isDockAction = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest("[data-dock-action]"));

/** Any touch on the page except the dock's action stops a running countdown, so the founder can change their mind. */
export function useStopOnTouch(armed: boolean, disarm: () => void) {
  const stop = useRef(disarm);
  useEffect(() => {
    stop.current = disarm;
  });
  useEffect(() => {
    if (!armed) return;
    const onTouch = (event: PointerEvent) => {
      if (!isDockAction(event.target)) stop.current();
    };
    document.addEventListener("pointerdown", onTouch, true);
    return () => document.removeEventListener("pointerdown", onTouch, true);
  }, [armed]);
}

type ActionProps = {
  icon: ReactNode;
  label: string;
  /** What the button says while it counts down, such as "Sending in 4". */
  armedLabel: (secondsLeft: number) => string;
  pending: boolean;
  armed: boolean;
  onPress: () => void;
};

/** The dock's one action. While armed it fills as it counts down and then presses itself. */
export function DockAction({ icon, label, armedLabel, pending, armed, onPress }: ActionProps) {
  const left = useCountdown(armed && !pending, onPress);
  return (
    <button
      type="button"
      data-dock-action
      onClick={onPress}
      disabled={pending}
      aria-busy={pending}
      className="bg-ink text-paper shadow-lifted relative inline-flex min-h-14 min-w-28 items-center justify-center overflow-hidden rounded-full px-4 text-base font-medium transition-[scale,opacity] duration-150 ease-knife active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-45"
    >
      {armed && !pending && <span aria-hidden="true" className="bg-paper/20 animate-countdown absolute inset-0 origin-left motion-reduce:animate-none" />}
      <span className="relative inline-flex items-center gap-2 tabular-nums">
        {pending ? <CircleNotch size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : icon}
        {armed ? armedLabel(left) : label}
      </span>
    </button>
  );
}

type Talk = { supported: boolean; listening: boolean; onToggle: () => void };

export function DockMic({ talk, disabled = false, label }: { talk: Talk; disabled?: boolean; label: string }) {
  if (!talk.supported) return <span className="size-16" aria-hidden="true" />;
  return (
    <button
      type="button"
      onClick={talk.onToggle}
      disabled={disabled}
      aria-pressed={talk.listening}
      className={`bg-ink text-paper shadow-lifted grid size-16 place-items-center rounded-full transition-[scale,opacity] duration-150 ease-knife active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-45 ${talk.listening ? "animate-listening motion-reduce:animate-none" : ""}`}
    >
      {talk.listening ? <Stop size={26} weight="fill" aria-hidden="true" /> : <Microphone size={28} weight="fill" aria-hidden="true" />}
      <span className="sr-only">{talk.listening ? "Done talking" : label}</span>
    </button>
  );
}

const SIDE_BUTTON =
  "shadow-lifted flex min-h-14 min-w-14 flex-col items-center justify-center gap-0.5 rounded-full px-3 text-xs font-medium backdrop-blur transition-[color,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-ink";

export function DockSideButton({ label, on, onClick, children }: { label: string; on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`${SIDE_BUTTON} ${on ? "bg-ink text-paper shadow-pointing" : "bg-paper/95 text-ink"}`}>
      {children}
      {label}
    </button>
  );
}

type TypeFieldProps = {
  id: string;
  label: string;
  text: string;
  onChange: (text: string) => void;
  /** Enter, or the button: keeps what was typed. */
  onKeep: () => void;
  keepLabel: string;
  /** Anything that goes with the note, such as whether it is for every site. */
  children?: ReactNode;
};

/** A text field above the dock for typing a note instead of saying it. */
export function DockTypeField({ id, label, text, onChange, onKeep, keepLabel, children }: TypeFieldProps) {
  const keep = () => {
    if (text.trim()) onKeep();
  };
  return (
    <div className={`${DOCK_CARD} flex flex-col gap-2`}>
      <div className="flex items-end gap-2">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <textarea
          id={id}
          autoFocus
          rows={2}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            keep();
          }}
          placeholder="What should change?"
          className="bg-surface border-ink/15 placeholder:text-ink-faint focus-visible:border-ink min-w-0 flex-1 resize-none rounded-lg border px-3 py-2 text-base focus-visible:outline-none"
        />
        <button type="button" onClick={keep} disabled={!text.trim()} className="bg-ink text-paper grid size-11 shrink-0 place-items-center rounded-full disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          <Plus size={18} weight="bold" aria-hidden="true" />
          <span className="sr-only">{keepLabel}</span>
        </button>
      </div>
      {children}
    </div>
  );
}

type SpokenProps = { spoken: string; listening: boolean; working?: boolean; notice: { text: string; bad: boolean } | null };

/** What the founder is saying, as the browser hears it, or the last thing the page has to tell them. */
export function DockSpoken({ spoken, listening, working = false, notice }: SpokenProps) {
  if (notice) {
    return (
      <p role={notice.bad ? "alert" : "status"} className={`${DOCK_CARD} text-sm font-medium ${notice.bad ? "text-bad" : "text-ink"}`}>
        {notice.text}
      </p>
    );
  }
  if (!listening && !working) return null;
  return (
    <p className={`${DOCK_CARD} flex items-start gap-2 text-base`}>
      {working && <CircleNotch size={18} className="text-ink-soft mt-0.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      <span className={spoken ? "text-ink" : "text-ink-faint"}>{spoken || "Listening. Say what should change, then tap the mic again."}</span>
    </p>
  );
}
