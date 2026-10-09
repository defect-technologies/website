"use client";

import { FloppyDisk } from "@phosphor-icons/react";
import { useActionState, useRef, useState } from "react";
import { saveTemplateAction, type TemplateResult } from "@/app/admin/(panel)/template/actions";
import { PLACEHOLDERS, type OutreachSettings, type Placeholder, type TemplateValues } from "@/lib/emailTemplate";
import { controlClass, TextField } from "./fields";
import Letter from "./Letter";
import SubmitButton from "./SubmitButton";
import { Card, Notice } from "./ui";

const TARGET_LINES = 4;

function LineCount({ text }: { text: string }) {
  const lines = text.split("\n").filter((line) => line.trim()).length;
  const over = lines > TARGET_LINES;
  return (
    <span className={`text-sm tabular-nums ${over ? "text-warn font-medium" : "text-ink-faint"}`}>
      {lines} {lines === 1 ? "line" : "lines"}
      {over ? `, ${lines - TARGET_LINES} over the four we aim for` : ""}
    </span>
  );
}

/** A template textarea with buttons that drop each placeholder in at the cursor. */
function TemplateArea({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const insert = (name: Placeholder) => {
    const element = area.current;
    const token = `{${name}}`;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <LineCount text={value} />
      </div>
      <textarea ref={area} id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)} rows={6} className={`${controlClass} resize-y leading-relaxed`} />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Insert into ${label.toLowerCase()}`}>
        {(Object.keys(PLACEHOLDERS) as Placeholder[]).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => insert(name)}
            aria-label={`Insert {${name}}: ${PLACEHOLDERS[name]}`}
            title={PLACEHOLDERS[name]}
            className="bg-paper-shade hover:bg-ink/10 min-h-8 rounded-md px-2 font-mono text-sm focus-visible:outline-2 focus-visible:outline-ink"
          >
            {`{${name}}`}
          </button>
        ))}
      </div>
    </div>
  );
}

type EditorProps = { settings: OutreachSettings; sample: TemplateValues; sampleName: string };

export default function TemplateEditor({ settings, sample, sampleName }: EditorProps) {
  const [state, action] = useActionState(saveTemplateAction, { ok: false, message: "" } as TemplateResult);
  const [firstEmail, setFirstEmail] = useState(settings.firstEmail);
  const [followUp, setFollowUp] = useState(settings.followUp);
  const [subject, setSubject] = useState(settings.subject);
  const [senderName, setSenderName] = useState(settings.senderName);
  const [address, setAddress] = useState(settings.mailingAddress);
  const values = { ...sample, sender: senderName, address: address || "{address}" };
  const filledSubject = subject.replace(/\{(\w+)\}/g, (m, name: Placeholder) => values[name] ?? m);

  return (
    <form action={action} className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <TextField label="Subject" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <TemplateArea id="firstEmail" label="First email" value={firstEmail} onChange={setFirstEmail} />
        <TemplateArea id="followUp" label="Follow-up" value={followUp} onChange={setFollowUp} />
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-lg font-semibold">Sender</legend>
          <TextField label="Name" name="senderName" value={senderName} onChange={(e) => setSenderName(e.target.value)} required />
          <TextField label="Mailing address" name="mailingAddress" value={address} onChange={(e) => setAddress(e.target.value)} hint="The virtual mailing address. Every cold email has to carry one." />
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-lg font-semibold">Checkout and pace</legend>
          <TextField label="$59 Stripe payment link" name="checkout59" type="url" defaultValue={settings.checkoutLinks["59"]} placeholder="https://buy.stripe.com/..." />
          <TextField label="$79 Stripe payment link" name="checkout79" type="url" defaultValue={settings.checkoutLinks["79"]} placeholder="https://buy.stripe.com/..." />
          <TextField label="Emails a day" name="dailyLimit" type="number" min={1} max={50} defaultValue={settings.dailyLimit} hint="First emails and follow-ups together." />
          <TextField label="Follow up after (days)" name="followUpAfterDays" type="number" min={1} max={30} defaultValue={settings.followUpAfterDays} />
        </fieldset>
        {state.message && <Notice tone={state.ok ? "good" : "bad"}>{state.message}</Notice>}
        <div>
          <SubmitButton variant="solid" icon={<FloppyDisk size={18} aria-hidden="true" />}>
            Save template
          </SubmitButton>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-8 xl:self-start">
        <p className="text-ink-soft text-sm">As {sampleName} would get them</p>
        <Card className="flex flex-col gap-4 p-4">
          <Letter subject={filledSubject} template={firstEmail} values={values} />
          <Letter subject={`Re: ${filledSubject}`} template={followUp} values={values} />
        </Card>
      </div>
    </form>
  );
}
