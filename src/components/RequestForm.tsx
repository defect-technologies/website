"use client";

import { CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { submitRequest, type RequestField, type RequestFormState } from "@/app/start/actions";
import { ABOUT_LIMIT } from "@/lib/inbound";
import { TextAreaField, TextField } from "./admin/fields";
import KnifeStroke from "./admin/KnifeStroke";
import SubmitButton from "./admin/SubmitButton";
import { Card, Notice } from "./admin/ui";

const STEPS = ["You tell us about the business", "We build its new website", "We email you the link", "You keep it for $79 a month, or you don't"];

/** The knife stroke marks where the visitor is: on the form while they fill it in, on the build once it's sent. */
function Steps({ current }: { current: number }) {
  return (
    <ol className="flex flex-col gap-1">
      {STEPS.map((step, index) => {
        const here = index === current;
        return (
          <li key={step} aria-current={here ? "step" : undefined} className={`relative isolate flex min-h-11 items-center gap-3 px-3 text-lg ${here ? "text-ink font-semibold" : "text-ink-soft"}`}>
            {here && <KnifeStroke variant={index} className="text-vermilion/30 absolute inset-x-0 inset-y-1 -z-10 h-[calc(100%-0.5rem)] w-full" />}
            <span className="tabular-nums">{index + 1}</span>
            <span>{step}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** A field bots fill in and people never see. */
function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
      <label>
        Company
        <input type="text" name="company" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

function Sent({ email }: { email: string }) {
  return (
    <Card className="flex flex-col items-start gap-4 p-6 sm:p-8" role="status">
      <CheckCircle size={40} weight="fill" className="text-good" aria-hidden="true" />
      <h2 className="font-display text-4xl leading-none font-black">Got it</h2>
      <p className="text-ink-soft text-lg text-pretty">
        We&apos;ll look at it and email <span className="text-ink font-medium">{email}</span>. If you need us before then, write to{" "}
        <a href="mailto:hello@defect.tech" className="decoration-ink/30 hover:decoration-ink text-ink underline underline-offset-4">
          hello@defect.tech
        </a>
        .
      </p>
    </Card>
  );
}

type Errors = Partial<Record<RequestField, string>>;

function useFirstErrorFocus(form: React.RefObject<HTMLFormElement | null>, state: RequestFormState) {
  useEffect(() => {
    if (state.state === "invalid") form.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [form, state]);
}

/** Submitted from code rather than through the form's action, so the time spent on the form can go with it. */
export default function RequestForm() {
  const [state, action, pending] = useActionState(submitRequest, { state: "idle" } as RequestFormState);
  const form = useRef<HTMLFormElement>(null);
  const openedAt = useRef(0);
  useFirstErrorFocus(form, state);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("elapsed", String(Date.now() - openedAt.current));
    startTransition(() => action(data));
  };

  const errors: Errors = state.state === "invalid" ? state.errors : {};
  const sent = state.state === "sent";

  return (
    <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
      <Steps current={sent ? 1 : 0} />
      {sent ? (
        <Sent email={state.email} />
      ) : (
        <Card className="p-6 sm:p-8">
          <form ref={form} onSubmit={submit} noValidate className="relative flex flex-col gap-5">
            <Honeypot />
            <TextField label="Business name" name="businessName" autoComplete="organization" error={errors.businessName} required />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="Your name" name="name" autoComplete="name" error={errors.name} required />
              <TextField label="Email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="name@example.com" error={errors.email} required />
            </div>
            <TextField
              label="Current website"
              name="website"
              inputMode="url"
              autoComplete="url"
              placeholder="sunrisebakery.com"
              error={errors.website}
              required
              hint="We redesign existing websites, so we can't take a business that doesn't have one yet."
            />
            <TextAreaField label="Anything we should know? (optional)" name="about" rows={3} maxLength={ABOUT_LIMIT} error={errors.about} />
            {state.state === "busy" && <Notice tone="bad">Too many requests came from your connection in the last hour. Email us at hello@defect.tech instead.</Notice>}
            <div>
              <SubmitButton variant="solid" pending={pending} icon={<PaperPlaneTilt size={18} weight="bold" aria-hidden="true" />}>
                Send request
              </SubmitButton>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
