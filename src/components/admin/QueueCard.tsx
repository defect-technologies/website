"use client";

import { ArrowCounterClockwise, Check, CheckCircle, FloppyDisk, LinkSimple, PaperPlaneTilt, PencilSimple, PencilSimpleLine, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { discardDraft, saveDraft, sendFromQueue, skipFromQueue, undoSkip } from "@/app/admin/(panel)/outreachActions";
import type { EmailDraft } from "@/lib/emailDraft";
import { withLinkMarkup } from "@/lib/emailMarkup";
import { asClause, fillTemplate, type TemplateValues } from "@/lib/emailTemplate";
import type { Business } from "@/server/db/schema";
import type { EmailKind } from "@/server/outreach/compose";
import { Button } from "../Button";
import { TextAreaField, TextField } from "./fields";
import Letter from "./Letter";
import PreviewThumb from "./PreviewThumb";
import { ArmChip, Card, Notice } from "./ui";

type QueueCardProps = {
  business: Business;
  kind: EmailKind;
  subject: string;
  template: string;
  values: TemplateValues;
  blockers: string[];
  editBlockers: string[];
  limitReached: boolean;
};

type Outcome = { state: "idle" } | { state: "sent"; to: string } | { state: "skipped" } | { state: "error"; message: string };

const REFRESH_AFTER_MS = 1600;

function ProblemEditor({ value, onChange, onDone }: { value: string; onChange: (v: string) => void; onDone: () => void }) {
  return (
    <input
      autoFocus
      aria-label="Problem line"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={onDone}
      onKeyDown={(event) => event.key === "Enter" && onDone()}
      className="bg-surface border-ink/30 my-0.5 w-full rounded-md border px-2 py-1 focus-visible:outline-2 focus-visible:outline-ink/20"
    />
  );
}

/** The text stays an inline mark so it wraps with the sentence; a button can't break across lines. */
function ProblemMark({ text, onEdit }: { text: string; onEdit: () => void }) {
  return (
    <>
      <mark className="bg-paper-shade text-ink rounded px-0.5">{text}</mark>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit the problem line"
        title="Edit the problem line"
        className="text-ink-faint hover:bg-paper-shade hover:text-ink mx-0.5 inline-grid size-7 place-items-center rounded-md align-middle focus-visible:outline-2 focus-visible:outline-ink"
      >
        <PencilSimple size={16} aria-hidden="true" />
      </button>
    </>
  );
}

function SentRow({ name, to }: { name: string; to: string }) {
  return (
    <Card className="flex items-center gap-3 px-5 py-4">
      <CheckCircle size={24} weight="fill" className="text-good shrink-0" aria-hidden="true" />
      <p role="status">
        Sent to {name} at <span className="font-medium">{to}</span>
      </p>
    </Card>
  );
}

function SkippedRow({ name, onUndo, pending }: { name: string; onUndo: () => void; pending: boolean }) {
  return (
    <Card className="flex items-center justify-between gap-3 px-5 py-3">
      <p role="status" className="text-ink-soft">
        Skipped {name}. It&apos;s marked lost in the pipeline.
      </p>
      <Button size="sm" variant="ghost" onClick={onUndo} disabled={pending} icon={<ArrowCounterClockwise size={16} aria-hidden="true" />}>
        Undo
      </Button>
    </Card>
  );
}

const KIND_CHIP: Record<EmailKind, string> = { first: "", follow_up: "Follow-up", requested: "From hello@" };

function Header({ business, kind, editing }: { business: Business; kind: QueueCardProps["kind"]; editing: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 className="text-xl font-semibold">
        <Link href={`/admin/pipeline/${business.id}`} className="hover:underline focus-visible:outline-2 focus-visible:outline-ink">
          {business.businessName}
        </Link>
      </h3>
      <div className="flex items-center gap-3">
        {kind !== "first" && <span className="bg-ink/8 rounded-full px-2.5 py-0.5 text-sm font-medium">{KIND_CHIP[kind]}</span>}
        <ArmChip arm={business.priceArm} />
      </div>
      {!editing && <p className="text-ink-faint w-full text-sm">To {business.email || "no address yet"}</p>}
    </div>
  );
}

function useProblemLine(business: Business) {
  const original = business.emailProblem || business.problemSummary;
  const [problem, setProblem] = useState(original);
  const [editing, setEditing] = useState(false);
  return { problem, setProblem, editing, setEditing, edited: problem !== original };
}

type ProblemLine = ReturnType<typeof useProblemLine>;

function EditableLetter({ subject, template, values, line }: { subject: string; template: string; values: TemplateValues; line: ProblemLine }) {
  const showProblem = (text: string) =>
    line.editing ? (
      <ProblemEditor value={line.problem} onChange={line.setProblem} onDone={() => line.setEditing(false)} />
    ) : (
      <ProblemMark text={text} onEdit={() => line.setEditing(true)} />
    );
  return (
    <Letter
      subject={subject}
      template={template}
      values={{ ...values, problem: asClause(line.problem) }}
      renderValue={(segment) => (segment.placeholder === "problem" ? showProblem(segment.text) : undefined)}
    />
  );
}

const DRAFT_FIELDS = ["to", "cc", "bcc", "subject", "body"] as const;

function savedDraftFor(business: Business, kind: EmailKind): EmailDraft | null {
  const saved = business.emailDraft;
  if (saved?.kind !== kind) return null;
  return { to: saved.to, cc: saved.cc, bcc: saved.bcc, subject: saved.subject, body: saved.body };
}

const sameDraft = (draft: EmailDraft, saved: EmailDraft | null) => DRAFT_FIELDS.every((field) => draft[field] === saved?.[field]);

/** A saved draft opens the card straight into editing, as the founder left it. */
function useEmailEdits(business: Business, kind: EmailKind, subject: string, composedBody: () => string) {
  const [saved, setSaved] = useState(() => savedDraftFor(business, kind));
  const [edits, setEdits] = useState<EmailDraft | null>(saved);
  const [saving, startSaving] = useTransition();
  const start = () => setEdits({ to: business.email, cc: "", bcc: "", subject, body: composedBody() });
  const change = (field: keyof EmailDraft, value: string) => setEdits((current) => current && { ...current, [field]: value });
  const save = () =>
    startSaving(async () => {
      if (edits && (await saveDraft(kind, business.id, edits)).ok) setSaved(edits);
    });
  const discard = () =>
    startSaving(async () => {
      setEdits(null);
      if (!saved) return;
      setSaved(null);
      await discardDraft(business.id);
    });
  return { edits, start, change, save, discard, saving, unsaved: edits !== null && !sameDraft(edits, saved) };
}

type EmailEditing = ReturnType<typeof useEmailEdits>;

type CopyField = "cc" | "bcc";

const COPY_LABEL: Record<CopyField, string> = { cc: "Cc", bcc: "Bcc" };

type EditorProps = { id: string; edits: EmailDraft; onChange: EmailEditing["change"] };

function AddressField({ id, field, label, edits, onChange, autoFocus, hint }: EditorProps & { field: "to" | CopyField; label: string; autoFocus?: boolean; hint?: string }) {
  return (
    <TextField
      id={`${id}-${field}`}
      label={label}
      hint={hint}
      inputMode="email"
      autoCapitalize="none"
      spellCheck={false}
      autoComplete="off"
      autoFocus={autoFocus}
      value={edits[field]}
      onChange={(event) => onChange(field, event.target.value)}
    />
  );
}

function CopyFields(props: EditorProps) {
  const [open, setOpen] = useState<CopyField[]>(() => (["cc", "bcc"] as const).filter((field) => props.edits[field] !== ""));
  const [opened, setOpened] = useState<CopyField | null>(null);
  const closed = (["cc", "bcc"] as const).filter((field) => !open.includes(field));
  return (
    <>
      {open.map((field) => (
        <AddressField key={field} {...props} field={field} label={COPY_LABEL[field]} autoFocus={field === opened} />
      ))}
      {closed.length > 0 && (
        <div className="-mt-2 flex gap-1">
          {closed.map((field) => (
            <Button key={field} size="sm" variant="ghost" onClick={() => {
                setOpen([...open, field]);
                setOpened(field);
              }} icon={<Plus size={14} weight="bold" aria-hidden="true" />}>
              Add {COPY_LABEL[field]}
            </Button>
          ))}
        </div>
      )}
    </>
  );
}

function BodyField({ id, edits, onChange }: EditorProps) {
  const area = useRef<HTMLTextAreaElement>(null);
  const addLink = () => {
    const element = area.current;
    if (!element) return;
    const { text, select } = withLinkMarkup(element.value, element.selectionStart, element.selectionEnd);
    onChange("body", text);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(...select);
    });
  };
  return (
    <>
      <TextAreaField
        ref={area}
        id={`${id}-body`}
        label="Email"
        rows={12}
        value={edits.body}
        onChange={(event) => onChange("body", event.target.value)}
        className="field-sizing-content leading-relaxed"
      />
      <div className="-mt-2">
        <Button size="sm" variant="ghost" onClick={addLink} icon={<LinkSimple size={16} weight="bold" aria-hidden="true" />}>
          Add link
        </Button>
      </div>
    </>
  );
}

function EmailEditor({ id, edits, onChange }: EditorProps) {
  return (
    <div className="bg-paper flex flex-col gap-4 rounded-xl p-4 sm:p-5">
      <AddressField id={id} edits={edits} onChange={onChange} field="to" label="To" hint="Separate several addresses with commas." />
      <CopyFields id={id} edits={edits} onChange={onChange} />
      <TextField id={`${id}-subject`} label="Subject" value={edits.subject} onChange={(event) => onChange("subject", event.target.value)} />
      <BodyField id={id} edits={edits} onChange={onChange} />
    </div>
  );
}

function SaveDraftButton({ editing, busy }: { editing: EmailEditing; busy: boolean }) {
  const label = editing.saving ? "Saving" : editing.unsaved ? "Save draft" : "Saved";
  const icon = editing.unsaved ? <FloppyDisk size={18} aria-hidden="true" /> : <Check size={18} weight="bold" aria-hidden="true" />;
  return (
    <Button variant="soft" onClick={editing.save} disabled={busy || !editing.unsaved} aria-busy={editing.saving} icon={icon}>
      {label}
    </Button>
  );
}

function EditControls({ editing, pending, onStart, onDiscard }: { editing: EmailEditing; pending: boolean; onStart: () => void; onDiscard: () => void }) {
  const busy = pending || editing.saving;
  if (!editing.edits) {
    return (
      <Button variant="ghost" onClick={onStart} disabled={busy} icon={<PencilSimpleLine size={18} aria-hidden="true" />}>
        Edit email
      </Button>
    );
  }
  return (
    <>
      <SaveDraftButton editing={editing} busy={busy} />
      <Button variant="ghost" onClick={onDiscard} disabled={busy} icon={<ArrowCounterClockwise size={18} aria-hidden="true" />}>
        Go back to the template
      </Button>
    </>
  );
}

type ActionsProps = { blockers: string[]; error: string; cannotSend: boolean; pending: boolean; onSend: () => void; onSkip: () => void; editControls: ReactNode };

function QueueActions({ blockers, error, cannotSend, pending, onSend, onSkip, editControls }: ActionsProps) {
  return (
    <>
      {blockers.length > 0 && (
        <Notice tone="warn">
          <ul className="flex flex-col gap-1">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </Notice>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="solid" onClick={onSend} disabled={cannotSend || pending} aria-busy={pending} icon={<PaperPlaneTilt size={18} weight="bold" aria-hidden="true" />}>
          {pending ? "Sending" : "Send"}
        </Button>
        {editControls}
        <Button variant="ghost" onClick={onSkip} disabled={pending}>
          Skip
        </Button>
      </div>
    </>
  );
}

export default function QueueCard({ business, kind, subject, template, values, blockers, editBlockers, limitReached }: QueueCardProps) {
  const router = useRouter();
  const editorId = useId();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<Outcome>({ state: "idle" });
  const line = useProblemLine(business);
  const editing = useEmailEdits(business, kind, subject, () => fillTemplate(template, { ...values, problem: asClause(line.problem) }));
  const shownBlockers = editing.edits ? editBlockers : blockers;

  const toggleEditing = (change: () => void) => () => {
    setOutcome({ state: "idle" });
    change();
  };

  const send = () =>
    startTransition(async () => {
      const result = await sendFromQueue(kind, business.id, line.edited ? line.problem : undefined, editing.edits ?? undefined);
      setOutcome(result.ok ? { state: "sent", to: result.to } : { state: "error", message: result.error });
      if (result.ok) setTimeout(() => router.refresh(), REFRESH_AFTER_MS);
    });

  const skip = () =>
    startTransition(async () => {
      if (!(await skipFromQueue(business.id)).ok) return;
      setOutcome({ state: "skipped" });
      router.refresh();
    });

  const undo = () =>
    startTransition(async () => {
      await undoSkip(business.id);
      setOutcome({ state: "idle" });
    });

  if (outcome.state === "sent") return <SentRow name={business.businessName} to={outcome.to} />;
  if (outcome.state === "skipped") return <SkippedRow name={business.businessName} onUndo={undo} pending={pending} />;

  return (
    <Card className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <Header business={business} kind={kind} editing={Boolean(editing.edits)} />
        {editing.edits ? (
          <EmailEditor id={editorId} edits={editing.edits} onChange={editing.change} />
        ) : (
          <EditableLetter subject={subject} template={template} values={values} line={line} />
        )}
        <QueueActions
          blockers={shownBlockers}
          error={outcome.state === "error" ? outcome.message : ""}
          cannotSend={shownBlockers.length > 0 || limitReached}
          pending={pending}
          onSend={send}
          onSkip={skip}
          editControls={<EditControls editing={editing} pending={pending} onStart={toggleEditing(editing.start)} onDiscard={toggleEditing(editing.discard)} />}
        />
      </div>
      <PreviewThumb url={business.previewUrl} name={business.businessName} />
    </Card>
  );
}
