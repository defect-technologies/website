"use client";

import { PaperPlaneTilt } from "@phosphor-icons/react";
import { useActionState } from "react";
import { requestLinkAction, type LinkRequestState } from "@/app/edit/actions";
import { TextField } from "@/components/admin/fields";
import SubmitButton from "@/components/admin/SubmitButton";
import { Notice } from "@/components/admin/ui";
import LinkSentNotice from "./LinkSentNotice";

function SentNotice({ email }: { email: string }) {
  return (
    <LinkSentNotice>
      If <span className="text-ink font-medium break-all">{email}</span> is the address on your account, a sign-in link is on its way. It opens the editor on your site once, within 10 minutes.
    </LinkSentNotice>
  );
}

const PROBLEMS: Partial<Record<LinkRequestState["status"], string>> = {
  invalid: "That email address doesn't look right. Check it and try again.",
  "not-ready": "Email sign-in isn't switched on yet. Email hello@defect.tech and we'll make your change for you.",
};

export default function SignInForm() {
  const [state, action] = useActionState(requestLinkAction, { status: "idle", email: "" } as LinkRequestState);
  if (state.status === "sent") return <SentNotice email={state.email} />;
  const problem = PROBLEMS[state.status];

  return (
    <form action={action} className="flex w-full flex-col gap-4 text-left">
      {problem && <Notice tone="bad">{problem}</Notice>}
      <TextField label="Your email" name="email" type="email" autoComplete="email" required defaultValue={state.email} hint="Use the address you gave us when your site went live." />
      <SubmitButton variant="solid" icon={<PaperPlaneTilt size={20} weight="bold" aria-hidden="true" />}>
        Email me a sign-in link
      </SubmitButton>
    </form>
  );
}
