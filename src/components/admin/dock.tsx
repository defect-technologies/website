"use client";

import { CircleNotch, Microphone, Plus, Stop } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useRef } from "react";
import { Button } from "@/components/Button";

// The controls a founder holds a phone by: a dock within thumb reach, with what it is about to do shown above it.
// The Review page and the Designs page are both worked from one.

/** The floating surface for anything shown above a dock's buttons. */
export const DOCK_CARD = "bg-paper/95 shadow-lifted pointer-events-auto rounded-2xl px-4 py-3 text-pretty backdrop-blur";

const isInsideDock = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest("[data-dock-action], [data-dock-confirm]"));

/** Any touch outside the dock's action and its confirm card closes the card, so it never outlives what it asked about. */
export function useCloseOnTouchElsewhere(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const onTouch = (event: PointerEvent) => {
      if (!isInsideDock(event.target)) closeRef.current();
    };
    document.addEventListener("pointerdown", onTouch, true);
    return () => document.removeEventListener("pointerdown", onTouch, true);
  }, [open]);
}

type ActionProps = { icon: ReactNode; label: string; pending: boolean; onPress: () => void };

/** The dock's one action. */
export function DockAction({ icon, label, pending, onPress }: ActionProps) {
  return (
    <button
      type="button"
      data-dock-action
      onClick={onPress}
      disabled={pending}
      aria-busy={pending}
      className="bg-ink text-paper shadow-lifted inline-flex min-h-14 min-w-28 items-center justify-center gap-2 rounded-full px-4 text-base font-medium transition-[scale,opacity] duration-150 ease-knife active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-45"
    >
      {pending ? <CircleNotch size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : icon}
      {label}
    </button>
  );
}

type Choice = { label: string; icon: ReactNode; onPress: () => void };

type ConfirmProps = {
  title: string;
  /** What the decision carries, such as the option's picture or the note that goes with it. */
  children?: ReactNode;
  icon: ReactNode;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** A second way to decide, beside the confirm: both sit in one row, and Not yet moves below them. */
  alternative?: Choice;
};

const spinnerOr = (pending: boolean, icon: ReactNode) => (pending ? <CircleNotch size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : icon);

/** A decision that can't be taken back waits here for a second, deliberate tap. Nothing happens on its own. */
export function DockConfirm({ title, children, icon, confirmLabel, pending, onConfirm, onCancel, alternative }: ConfirmProps) {
  const notYet = (
    <Button variant={alternative ? "ghost" : "soft"} onClick={onCancel} disabled={pending} className="flex-1">
      Not yet
    </Button>
  );
  return (
    <div data-dock-confirm role="dialog" aria-label={title} className={`${DOCK_CARD} flex flex-col gap-3`}>
      <p className="text-base font-semibold text-balance">{title}</p>
      {children}
      <div className="flex gap-2">
        {alternative ? (
          <Button variant="soft" onClick={alternative.onPress} disabled={pending} className="flex-1" icon={alternative.icon}>
            {alternative.label}
          </Button>
        ) : (
          notYet
        )}
        <Button variant="solid" onClick={onConfirm} disabled={pending} aria-busy={pending} autoFocus className="flex-1" icon={spinnerOr(pending, icon)}>
          {confirmLabel}
        </Button>
      </div>
      {alternative && <div className="flex">{notYet}</div>}
    </div>
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
  /** Anything that goes with the note. */
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
