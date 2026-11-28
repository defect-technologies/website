"use client";

import { ArrowsClockwise, ArrowUp, Check, Hammer, X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { BoardOption } from "@/lib/boards";
import { Button } from "../../Button";
import { BoardPicture } from "../designs/parts";
import FeedbackField from "../designs/FeedbackField";
import SubmitButton from "../SubmitButton";
import { Card } from "../ui";

/** The designer's answer to whether one of the three is good enough to build. */
export type Answer = "build" | "redraw";

type Note = { text: string; setText: (update: (current: string) => string) => void };

function AnswerButton({ on, icon, onClick, children }: { on: boolean; icon: ReactNode; onClick: () => void; children: string }) {
  return (
    <Button variant={on ? "solid" : "soft"} aria-pressed={on} icon={icon} onClick={onClick}>
      {children}
    </Button>
  );
}

function BuildStep({ chosen, note }: { chosen: BoardOption | undefined; note: Note }) {
  if (!chosen) {
    return (
      <p className="text-ink-soft flex items-center gap-2">
        <ArrowUp size={18} aria-hidden="true" />
        Pick the one to build from the three above.
      </p>
    );
  }
  const letter = chosen.letter.toUpperCase();
  return (
    <>
      <div className="flex items-start gap-4">
        <span className="w-14 shrink-0">
          <BoardPicture src={chosen.pictures.phone} alt="" className="aspect-[390/844] rounded-md object-cover object-top" />
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-balance">
            Ready to build {letter}, {chosen.name}?
          </h3>
          <p className="text-ink-soft max-w-prose text-sm text-pretty">We build the whole site from it. When it&rsquo;s done, it shows up on your To do page so you can check it before the owner sees it.</p>
        </div>
      </div>
      <FeedbackField text={note.text} setText={note.setText} label="Anything to change while building it? (optional)" placeholder="Swap the hero photo for the one of their storefront." />
      <SubmitButton variant="solid" icon={<Hammer size={18} aria-hidden="true" />} className="w-fit">
        Build {letter}
      </SubmitButton>
    </>
  );
}

function RedrawStep({ note, redraw }: { note: Note; redraw: (formData: FormData) => Promise<void> }) {
  return (
    <>
      <FeedbackField text={note.text} setText={note.setText} required label="What should the new designs do differently?" placeholder="All three play it too safe. Try their own photos and one bold colour." />
      <div className="flex flex-col gap-2">
        <SubmitButton variant="solid" formAction={redraw} formNoValidate disabled={!note.text.trim()} icon={<ArrowsClockwise size={18} aria-hidden="true" />} className="w-fit">
          Draw three new designs
        </SubmitButton>
        <p className="text-ink-soft max-w-prose text-sm text-pretty">We&rsquo;ll show you the new designs on your To do page when they&rsquo;re ready.</p>
      </div>
    </>
  );
}

type Props = { answer: Answer | null; onAnswer: (answer: Answer) => void; chosen: BoardOption | undefined; note: Note; redraw: (formData: FormData) => Promise<void> };

/** The one question a designer answers about the three designs, and what follows from a yes or a no. */
export default function DecisionPanel({ answer, onAnswer, chosen, note, redraw }: Props) {
  return (
    <Card className="flex scroll-mb-6 flex-col gap-5 p-5 lg:p-6">
      <h2 className="text-2xl font-semibold text-balance">Are any of these good enough to build?</h2>
      <div role="group" aria-label="Your answer" className="flex flex-wrap gap-2">
        <AnswerButton on={answer === "build"} icon={<Check size={18} weight="bold" aria-hidden="true" />} onClick={() => onAnswer("build")}>
          Yes, build one
        </AnswerButton>
        <AnswerButton on={answer === "redraw"} icon={<X size={18} weight="bold" aria-hidden="true" />} onClick={() => onAnswer("redraw")}>
          No, draw new ones
        </AnswerButton>
      </div>
      {answer === "build" && <BuildStep chosen={chosen} note={note} />}
      {answer === "redraw" && <RedrawStep note={note} redraw={redraw} />}
    </Card>
  );
}
