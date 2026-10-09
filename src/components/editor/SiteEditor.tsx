"use client";

import { ArrowCounterClockwise, CheckCircle, CircleNotch, CloudArrowUp, EnvelopeSimple } from "@phosphor-icons/react";
import { startTransition, useActionState, useMemo, useState, type FormEvent } from "react";
import { saveSiteAction, type SaveState } from "@/app/edit/actions";
import { Button } from "@/components/Button";
import { Notice } from "@/components/admin/ui";
import { applyEditable, type EditableContent, type SiteContent } from "@/lib/siteContent";
import { fromDraft, toDraft, type Draft } from "./draft";
import { AboutFields, ContactFields, HoursFields, SectionOrderFields, ServicesFields, WordingFields } from "./sections";
import SitePreview from "./SitePreview";

type EditorProps = { slug: string; content: SiteContent; editable: EditableContent; version: number; assetBaseUrl: string; liveUrl: string };

function SaveMessage({ state, dirty }: { state: SaveState; dirty: boolean }) {
  if (state.ok === false) {
    return (
      <Notice tone="bad">
        {state.problems.length === 1 ? (
          state.problems[0]
        ) : (
          <ul className="list-disc pl-4">
            {state.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
      </Notice>
    );
  }
  if (state.ok && !dirty) return <Notice tone="good">{state.message}</Notice>;
  return null;
}

const SPINNER = <CircleNotch size={18} weight="bold" className="animate-spin motion-reduce:animate-none" aria-hidden="true" />;

function SaveBar({ dirty, pending, onDiscard }: { dirty: boolean; pending: boolean; onDiscard: () => void }) {
  return (
    <div className="bg-surface/95 shadow-lifted sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3 pl-5 backdrop-blur">
      <p className="flex items-center gap-2 text-sm" aria-live="polite">
        {dirty ? (
          <>
            <span className="bg-vermilion size-2 rounded-full" aria-hidden="true" />
            Not published yet
          </>
        ) : (
          <>
            <CheckCircle size={18} weight="fill" className="text-good" aria-hidden="true" />
            Everything is published
          </>
        )}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" disabled={!dirty} onClick={onDiscard} icon={<ArrowCounterClockwise size={16} aria-hidden="true" />}>
          Discard changes
        </Button>
        <Button type="submit" variant="solid" size="sm" disabled={!dirty || pending} aria-busy={pending} icon={pending ? SPINNER : <CloudArrowUp size={18} weight="bold" aria-hidden="true" />}>
          Publish changes
        </Button>
      </div>
    </div>
  );
}

const BIGGER_CHANGE = "mailto:hello@defect.tech?subject=" + encodeURIComponent("A change to my website");

export default function SiteEditor({ slug, content, editable, version, assetBaseUrl, liveUrl }: EditorProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(editable));
  const [published, setPublished] = useState({ editable, version });
  const current = useMemo(() => fromDraft(draft), [draft]);
  const dirty = JSON.stringify(current) !== JSON.stringify(published.editable);
  const previewContent = useMemo(() => applyEditable(content, current), [content, current]);

  const [state, action, pending] = useActionState(async (previous: SaveState, form: FormData): Promise<SaveState> => {
    const result = await saveSiteAction(previous, form);
    if (result.ok) setPublished({ editable: JSON.parse(String(form.get("content"))) as EditableContent, version: result.version });
    return result;
  }, { ok: null });

  const update = (patch: Partial<Draft>) => setDraft((previous) => ({ ...previous, ...patch }));
  const discard = () => setDraft(toDraft(published.editable));
  // Submitted by hand rather than through <form action>, which resets every field after the action and unticks the hours checkboxes.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => action(form));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,36rem)_minmax(0,1fr)]">
      <form onSubmit={submit} className="flex min-w-0 flex-col gap-5">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="baseVersion" value={published.version} />
        <input type="hidden" name="content" value={JSON.stringify(current)} />
        <WordingFields draft={draft} update={update} />
        <ServicesFields draft={draft} update={update} />
        <AboutFields draft={draft} update={update} />
        <HoursFields draft={draft} update={update} />
        <ContactFields draft={draft} update={update} />
        <SectionOrderFields draft={draft} update={update} />
        <a href={BIGGER_CHANGE} className="text-ink-soft hover:text-ink flex min-h-11 w-fit items-center gap-2 rounded-lg px-1 underline decoration-ink/30 underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-ink">
          <EnvelopeSimple size={18} aria-hidden="true" />
          Need something bigger? Send us a message
        </a>
        <SaveMessage state={state} dirty={dirty} />
        <SaveBar dirty={dirty} pending={pending} onDiscard={discard} />
      </form>
      <div id="preview" className="lg:sticky lg:top-6 lg:h-[calc(100svh-3rem)]">
        <SitePreview content={previewContent} assetBaseUrl={assetBaseUrl} liveUrl={liveUrl} />
      </div>
    </div>
  );
}
