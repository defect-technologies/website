"use client";

import { EnvelopeSimple, SignIn } from "@phosphor-icons/react";
import { useActionState } from "react";
import { signInAction, type SignInState } from "@/app/portal/actions";
import { TextField } from "@/components/admin/fields";
import SubmitButton from "@/components/admin/SubmitButton";
import { Notice } from "@/components/admin/ui";
import LinkSentNotice from "@/components/editor/LinkSentNotice";

const PROBLEMS: Partial<Record<SignInState["status"], string>> = {
  wrong: "That email and password don't match. Try again, or email yourself a link.",
  locked: "Too many tries. Wait 15 minutes, or email yourself a link.",
  invalid: "That email address doesn't look right. Check it and try again.",
  "not-ready": "Email sign-in isn't switched on yet. Email hello@defect.tech and we'll help you in.",
};

export default function PortalSignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInAction, { status: "idle", email: "" } as SignInState);
  if (state.status === "sent") {
    return (
      <LinkSentNotice>
        If <span className="text-ink font-medium break-all">{state.email}</span> owns a site with us, a sign-in link is on its way. It works once, within 15 minutes.
      </LinkSentNotice>
    );
  }
  const problem = PROBLEMS[state.status];
  return (
    <form action={action} className="flex w-full flex-col gap-4 text-left">
      {problem && <Notice tone="bad">{problem}</Notice>}
      <input type="hidden" name="next" value={next} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.email} />
      <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
      <SubmitButton name="intent" value="password" variant="solid" icon={<SignIn size={20} weight="bold" aria-hidden="true" />}>
        Sign in
      </SubmitButton>
      <SubmitButton name="intent" value="link" variant="soft" formNoValidate icon={<EnvelopeSimple size={20} aria-hidden="true" />}>
        Email me a link instead
      </SubmitButton>
      <p className="text-ink-soft text-center text-sm text-pretty">No password yet? Email yourself a link, then set one in your portal.</p>
    </form>
  );
}
