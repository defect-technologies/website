"use client";

import { Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { deleteExpenseAction } from "@/app/admin/(panel)/expenses/actions";
import { Button } from "../Button";
import SubmitButton from "./SubmitButton";

/** Asks once before deleting, since a deleted expense changes what's owed. */
export default function DeleteExpenseButton({ id, item }: { id: string; item: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" size="icon" onClick={() => setConfirming(true)} aria-label={`Delete ${item}`}>
        <Trash size={18} aria-hidden="true" />
      </Button>
    );
  }

  return (
    <form action={deleteExpenseAction} className="bg-surface absolute inset-y-0 right-2 flex items-center gap-1 pl-2">
      <input type="hidden" name="id" value={id} />
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Keep
      </Button>
      <SubmitButton variant="danger" size="sm" autoFocus>
        Delete
      </SubmitButton>
    </form>
  );
}
