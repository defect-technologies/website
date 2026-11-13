"use client";

import { Check, Crosshair, Keyboard, PaperPlaneTilt } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import { DOCK_CARD, DockAction, DockMic, DockSideButton, DockSpoken, DockTypeField } from "../dock";

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

/** The floating surface for anything shown above the dock's buttons. */
export const CARD = DOCK_CARD;

/**
 * The review page's controls on a phone, within thumb reach: point at a part of the preview, talk, and send.
 * Notes split from speech send themselves after a countdown that any touch stops.
 */
export default function PhoneDock({ pointing, onPoint, typing, talk, spoken, splitting, notice, count, pending, armed, onSubmit, ask }: Props) {
  const [typingOpen, setTypingOpen] = useState(false);
  const keepTyped = () => {
    typing.onAdd();
    setTypingOpen(false);
  };
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      {ask}
      {typingOpen && <DockTypeField id="phone-note" label="Type a note" text={typing.text} onChange={typing.onChange} onKeep={keepTyped} keepLabel="Add note" />}
      <div aria-live="polite" className="empty:hidden">
        <DockSpoken spoken={spoken} listening={talk.listening} working={splitting} notice={notice} />
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        <DockSideButton label="Point" on={pointing} onClick={onPoint}>
          <Crosshair size={22} weight={pointing ? "bold" : "regular"} aria-hidden="true" />
        </DockSideButton>
        <DockSideButton label="Type" on={typingOpen} onClick={() => setTypingOpen((open) => !open)}>
          <Keyboard size={22} aria-hidden="true" />
        </DockSideButton>
        <span className="flex flex-1 justify-center">
          <DockMic talk={talk} disabled={splitting} label="Talk about this preview" />
        </span>
        <DockAction
          icon={count ? <PaperPlaneTilt size={20} aria-hidden="true" /> : <Check size={20} weight="bold" aria-hidden="true" />}
          label={count ? `Send ${count}` : "Approve"}
          armedLabel={(left) => (count ? `Sending in ${left}` : `Approving in ${left}`)}
          pending={pending}
          armed={armed}
          onPress={onSubmit}
        />
      </div>
    </div>
  );
}
