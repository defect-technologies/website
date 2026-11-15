"use client";

import { ArrowsClockwise, Hammer, PencilSimpleLine } from "@phosphor-icons/react";
import { useState } from "react";
import { redrawBoardsAction, reviseBoardAction } from "@/app/admin/(panel)/designs/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card } from "@/components/admin/ui";
import FeedbackField from "./FeedbackField";

/**
 * What a founder decides about the three designs, with what should change: build the chosen one, have it revised with
 * their words first (only once there are words), or ask for three new ones.
 */
export default function DecisionBar() {
  const [note, setNote] = useState("");
  return (
    <Card className="flex flex-col gap-4 p-5 lg:sticky lg:bottom-4 lg:flex-row lg:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <FeedbackField text={note} setText={setNote} />
        <label className="text-ink-soft flex min-h-9 w-fit cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" name="remember" className="accent-ink size-4 shrink-0" />
          Remember this for every site
        </label>
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        <SubmitButton variant="solid" icon={<Hammer size={18} aria-hidden="true" />}>
          Build the chosen design
        </SubmitButton>
        <SubmitButton variant="soft" formAction={reviseBoardAction} disabled={!note.trim()} icon={<PencilSimpleLine size={18} aria-hidden="true" />}>
          Revise the chosen design
        </SubmitButton>
        <SubmitButton variant="ghost" formAction={redrawBoardsAction} formNoValidate icon={<ArrowsClockwise size={18} aria-hidden="true" />}>
          Draw three new designs
        </SubmitButton>
      </div>
    </Card>
  );
}
