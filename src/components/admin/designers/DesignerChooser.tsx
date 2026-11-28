"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardOption } from "@/lib/boards";
import DecisionPanel, { type Answer } from "./DecisionPanel";
import DesignOption from "./DesignOption";

/** What a designer's decision calls: build the picked design, or draw three new ones from their notes. */
export type DesignerBoardActions = {
  choose: (formData: FormData) => Promise<void>;
  redraw: (formData: FormData) => Promise<void>;
};

/**
 * Brings the question into view, so a designer who picked a design sees what comes next. Only where the three sit side
 * by side: on a phone they are stacked, and jumping to the question would skip the designs below the picked one.
 */
function revealPanel(panel: HTMLDivElement | null) {
  if (!window.matchMedia("(min-width: 64rem)").matches) return;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  panel?.scrollIntoView({ block: "nearest", behavior: calm ? "instant" : "smooth" });
}

/**
 * The three designs for a business, then one question: is one good enough to build? A yes builds the picked design;
 * a no draws three new ones from the designer's notes.
 */
export default function DesignerChooser({ boardId, options, actions }: { boardId: string; options: BoardOption[]; actions: DesignerBoardActions }) {
  const [letter, setLetter] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [note, setNote] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (letter) revealPanel(panel.current);
  }, [letter]);

  const pick = (next: string) => {
    setLetter(next);
    setAnswer("build");
  };
  const answerWith = (next: Answer) => {
    setAnswer(next);
    if (next === "redraw") setLetter(null);
  };

  return (
    <form action={actions.choose} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={boardId} />
      <fieldset className="grid gap-5 lg:grid-cols-3">
        <legend className="sr-only">The three designs</legend>
        {options.map((option) => (
          <DesignOption key={option.letter} option={option} selected={letter === option.letter} onSelect={() => pick(option.letter)} />
        ))}
      </fieldset>
      <div ref={panel}>
        <DecisionPanel answer={answer} onAnswer={answerWith} chosen={options.find((option) => option.letter === letter)} note={{ text: note, setText: setNote }} redraw={actions.redraw} />
      </div>
    </form>
  );
}
