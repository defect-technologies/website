"use client";

import { useActionState } from "react";
import { setPasswordAction, type PasswordState } from "@/app/portal/actions";
import { TextField } from "@/components/admin/fields";
import SubmitButton from "@/components/admin/SubmitButton";
import { Notice } from "@/components/admin/ui";

const RESULT: Partial<Record<PasswordState["status"], { tone: "good" | "bad"; text: string }>> = {
  saved: { tone: "good", text: "Saved. Next time, sign in with your email and this password." },
  "too-short": { tone: "bad", text: "Use at least 10 characters." },
  "wrong-current": { tone: "bad", text: "Your current password doesn't match. Forgot it? Sign out and email yourself a link." },
};

export default function PasswordForm({ hasPassword, email }: { hasPassword: boolean; email: string }) {
  const [state, action] = useActionState(setPasswordAction, { status: "idle" } as PasswordState);
  const result = RESULT[state.status];
  const changing = hasPassword || state.status === "saved";
  return (
    <form action={action} className="flex flex-col gap-4">
      {result && <Notice tone={result.tone}>{result.text}</Notice>}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      {changing && <TextField label="Current password" name="current" type="password" autoComplete="current-password" required />}
      <TextField label={changing ? "New password" : "Password"} name="password" type="password" autoComplete="new-password" minLength={10} required hint="At least 10 characters." />
      <SubmitButton variant="soft" className="self-start">
        {changing ? "Change password" : "Set password"}
      </SubmitButton>
    </form>
  );
}
