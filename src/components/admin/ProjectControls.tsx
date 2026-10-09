"use client";

import { ArrowsClockwise, Star, X } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { disconnectMailboxAction, makeSenderAction, syncPaymentsAction } from "@/app/admin/(panel)/projects/actions";
import { Button } from "../Button";

export function MakeSenderButton({ mailboxId }: { mailboxId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(() => makeSenderAction(mailboxId))} icon={<Star size={16} aria-hidden="true" />}>
      Send from this one
    </Button>
  );
}

export function DisconnectButton({ mailboxId, email }: { mailboxId: string; email: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!confirming) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} icon={<X size={16} aria-hidden="true" />}>
        Disconnect
      </Button>
    );
  }
  return (
    <div role="group" aria-label={`Disconnect ${email}`} className="flex flex-wrap items-center gap-2">
      <span className="text-bad text-sm">Stop sending and reading as {email}?</span>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => startTransition(() => disconnectMailboxAction(mailboxId))}>
        Disconnect
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
        Keep it
      </Button>
    </div>
  );
}

export function SyncPaymentsButton() {
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        disabled={pending}
        aria-busy={pending}
        onClick={() => startTransition(async () => setSummary((await syncPaymentsAction()).summary))}
        icon={<ArrowsClockwise size={16} weight="bold" className={pending ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden="true" />}
      >
        Check for payments
      </Button>
      {summary && (
        <p role="status" className="text-ink-soft text-sm">
          {summary}
        </p>
      )}
    </div>
  );
}
