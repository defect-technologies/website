"use client";

import { ArrowsClockwise, PaperPlaneTilt, Prohibit } from "@phosphor-icons/react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { checkMailAction, optOutAction, replyAction, type ReplyState } from "@/app/admin/(panel)/messages/actions";
import { Button } from "../Button";
import { controlClass } from "./fields";
import SubmitButton from "./SubmitButton";
import { Notice } from "./ui";

export function CheckMailButton() {
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState("");
  const check = () => startTransition(async () => setSummary((await checkMailAction()).summary));
  return (
    <div className="flex items-center gap-3">
      {summary && (
        <p role="status" className="text-ink-soft text-sm">
          {summary}
        </p>
      )}
      <Button size="sm" onClick={check} disabled={pending} aria-busy={pending} icon={<ArrowsClockwise size={16} weight="bold" className={pending ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden="true" />}>
        Check mail
      </Button>
    </div>
  );
}

export function ReplyBox({ businessId, to }: { businessId: string; to: string }) {
  const [state, action] = useActionState(replyAction.bind(null, businessId), { ok: false } as ReplyState);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.sentAt) form.current?.reset();
  }, [state.sentAt]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <label htmlFor="reply" className="text-sm font-medium">
        Reply to {to}
      </label>
      <textarea id="reply" name="body" required rows={5} className={`${controlClass} resize-y`} placeholder="Hi Sam," />
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      {state.sentAt && <Notice tone="good">Sent.</Notice>}
      <div className="flex justify-end">
        <SubmitButton variant="solid" icon={<PaperPlaneTilt size={18} weight="bold" aria-hidden="true" />}>
          Send reply
        </SubmitButton>
      </div>
    </form>
  );
}

/** Opting out is permanent for the whole email domain, so it asks once more before doing it. */
export function OptOutButton({ businessId, domain, suggested }: { businessId: string; domain: string; suggested: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!confirming) {
    return (
      <Button size="sm" variant={suggested ? "soft" : "ghost"} onClick={() => setConfirming(true)} icon={<Prohibit size={16} aria-hidden="true" />}>
        Mark opted out
      </Button>
    );
  }
  return (
    <div role="group" aria-label="Confirm opt-out" className="bg-bad/10 flex flex-wrap items-center gap-2 rounded-full py-1 pr-1 pl-4">
      <span className="text-bad text-sm">Nobody at {domain || "this address"} will be emailed again.</span>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => startTransition(() => optOutAction(businessId))}>
        Opt out
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}
