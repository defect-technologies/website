"use client";

import { useState, type ReactNode } from "react";
import { Button } from "../Button";
import SubmitButton from "./SubmitButton";

type Props = { action: (form: FormData) => Promise<void>; id: string; label: string; confirmLabel: string; icon?: ReactNode };

/** A row's button (an icon, or its confirm label as text) that asks once before acting, for changes that move what's owed. */
export default function ConfirmRowButton({ action, id, label, confirmLabel, icon }: Props) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" size={icon ? "icon" : "sm"} onClick={() => setConfirming(true)} aria-label={label}>
        {icon ?? confirmLabel}
      </Button>
    );
  }

  return (
    <form action={action} className="bg-surface absolute inset-y-0 right-2 flex items-center gap-1 pl-2">
      <input type="hidden" name="id" value={id} />
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Keep
      </Button>
      <SubmitButton variant="danger" size="sm" autoFocus>
        {confirmLabel}
      </SubmitButton>
    </form>
  );
}
