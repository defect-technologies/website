"use client";

import { useState, type ReactNode } from "react";
import { Button } from "../../Button";
import SubmitButton from "../SubmitButton";

/** An action on every waiting design, taken after one confirming tap: the first tap names it, the second does it. */
export default function ConfirmAll({ action, icon, label, confirm }: { action: () => Promise<void>; icon: ReactNode; label: string; confirm: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" icon={icon} onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Keep them
      </Button>
      <SubmitButton variant="danger" size="sm" icon={icon} autoFocus>
        {confirm}
      </SubmitButton>
    </form>
  );
}
