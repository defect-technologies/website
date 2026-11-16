"use client";

import { ArrowsClockwise } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "../../Button";
import SubmitButton from "../SubmitButton";

/** Every waiting design drawn again with the runner's current system, after one confirming tap. */
export default function RedrawAll({ action, count }: { action: () => Promise<void>; count: number }) {
  const [confirming, setConfirming] = useState(false);
  const icon = <ArrowsClockwise size={18} weight="bold" aria-hidden="true" />;

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" icon={icon} onClick={() => setConfirming(true)}>
        Redraw all {count}
      </Button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Keep them
      </Button>
      <SubmitButton variant="danger" size="sm" icon={icon} autoFocus>
        Replace all {count} with new designs
      </SubmitButton>
    </form>
  );
}
