"use client";

import { ArrowsClockwise, Hammer, PencilSimpleLine } from "@phosphor-icons/react";
import { useState } from "react";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card } from "@/components/admin/ui";
import type { BoardActions } from "./boardActions";
import FeedbackField from "./FeedbackField";

/**
 * What a founder or designer decides about the three designs, with what should change: build the chosen one, have it revised with
 * their words first (only once there are words), or ask for three new ones.
 */
export default function DecisionBar({ revise, redraw }: Pick<BoardActions, "revise" | "redraw">) {
  const [note, setNote] = useState("");
  return (
    <Card className="flex flex-col gap-4 p-5 lg:sticky lg:bottom-4 lg:flex-row lg:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <FeedbackField text={note} setText={setNote} />
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        <SubmitButton variant="solid" icon={<Hammer size={18} aria-hidden="true" />}>
          Build the chosen design
        </SubmitButton>
        <SubmitButton variant="soft" formAction={revise} disabled={!note.trim()} icon={<PencilSimpleLine size={18} aria-hidden="true" />}>
          Revise the chosen design
        </SubmitButton>
        <SubmitButton variant="ghost" formAction={redraw} formNoValidate icon={<ArrowsClockwise size={18} aria-hidden="true" />}>
          Draw three new designs
        </SubmitButton>
      </div>
    </Card>
  );
}
