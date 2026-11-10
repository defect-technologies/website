"use client";

import { ArrowCounterClockwise, CircleNotch, PaperPlaneTilt } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/Button";
import { TASTE_SEND_SECONDS } from "@/lib/taste";

type Props = { counting: boolean; sending: boolean; onSend: () => void; onStartOver: () => void };

function useCountdown(counting: boolean, onDone: () => void) {
  const [left, setLeft] = useState(TASTE_SEND_SECONDS);
  useEffect(() => {
    if (!counting) return;
    const started = Date.now();
    const timer = setInterval(() => {
      const remaining = TASTE_SEND_SECONDS - Math.floor((Date.now() - started) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(timer);
        onDone();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [counting, onDone]);
  return left;
}

/** Sends by itself after a few seconds unless the founder touches the notes; a tap sends straight away. */
export default function SendBar({ counting, sending, onSend, onStartOver }: Props) {
  const left = useCountdown(counting && !sending, onSend);
  const label = sending ? "Sending" : counting ? `Sending in ${left}` : "Send";
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onStartOver} disabled={sending} className={buttonClasses("ghost", "md")}>
        <ArrowCounterClockwise size={18} aria-hidden="true" />
        Start over
      </button>
      <button type="button" onClick={onSend} disabled={sending} className={buttonClasses("solid", "md", "relative flex-1 overflow-hidden")}>
        {counting && !sending && <span aria-hidden="true" className="bg-paper/20 animate-countdown absolute inset-0 origin-left motion-reduce:animate-none" />}
        <span className="relative inline-flex items-center gap-2 tabular-nums">
          {sending ? <CircleNotch size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <PaperPlaneTilt size={18} aria-hidden="true" />}
          {label}
        </span>
      </button>
    </div>
  );
}
