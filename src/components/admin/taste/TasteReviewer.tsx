"use client";

import { Check, CircleNotch, Microphone, SkipForward, Stop, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { draftNotesAction, sendReviewAction } from "@/app/admin/taste/actions";
import { buttonClasses } from "@/components/Button";
import { useDictation } from "@/hooks/useDictation";
import type { TasteNote, TasteScope, TasteVerdict } from "@/lib/taste";
import type { TasteEntry } from "@/server/taste";
import KnifeStroke from "../KnifeStroke";
import NoteCard from "./NoteCard";
import SendBar from "./SendBar";

type Phase = "looking" | "listening" | "drafting" | "checking" | "sending";
type Draft = { verdict: TasteVerdict; transcript: string; notes: TasteNote[] };
type Result = Awaited<ReturnType<typeof sendReviewAction>>;

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function describeResult(name: string, verdict: TasteVerdict, result: Result) {
  if (verdict === "approved") return `${name} is approved.`;
  const rules = result.rules ? ` ${plural(result.rules, "rule")} saved for every site.` : "";
  if (result.rebuilt) return `Rebuilding ${name} with your notes.${rules}`;
  return `Notes saved for ${name}.${rules}`;
}

function rotate<T>(list: T[]): T[] {
  return list.length > 1 ? [...list.slice(1), list[0]] : list;
}

function EmptyQueue() {
  return (
    <main className="bg-paper grid min-h-svh place-items-center px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <KnifeStroke className="text-vermilion h-6 w-24" />
        <h1 className="font-display text-ink text-4xl font-bold">Nothing to review</h1>
        <p className="text-ink-soft max-w-xs text-base text-pretty">New previews show up here as soon as they&apos;re built.</p>
        <Link href="/admin" className={buttonClasses("soft", "md")}>
          Back to Today
        </Link>
      </div>
    </main>
  );
}

function Header({ entry, position, total }: { entry: TasteEntry; position: number; total: number }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 px-2">
      <Link href="/admin" className={buttonClasses("ghost", "icon")}>
        <X size={20} aria-hidden="true" />
        <span className="sr-only">Close and go back to Today</span>
      </Link>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{entry.businessName}</h1>
      <span className="text-ink-faint px-2 text-sm tabular-nums">
        {position} of {total}
      </span>
    </header>
  );
}

function PreviewFrame({ entry }: { entry: TasteEntry }) {
  return (
    <div className="relative min-h-0 flex-1 sm:grid sm:place-items-center sm:p-6">
      <div className="h-full w-full overflow-hidden bg-white sm:aspect-[390/844] sm:h-full sm:max-h-[844px] sm:w-auto sm:rounded-[2.5rem] sm:shadow-lifted">
        <iframe
          key={entry.previewUrl}
          src={entry.previewUrl}
          title={`${entry.businessName} preview`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}

type DockProps = { phase: Phase; onSkip: () => void; onTalk: () => void; onDone: () => void; onApprove: () => void };

function DockButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-ink-soft hover:text-ink flex min-h-14 min-w-20 flex-col items-center justify-center gap-1 rounded-2xl text-sm font-medium transition-[color,opacity] duration-150 focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-35"
    >
      {children}
      {label}
    </button>
  );
}

function Dock({ phase, onSkip, onTalk, onDone, onApprove }: DockProps) {
  const listening = phase === "listening";
  const busy = phase !== "looking";
  return (
    <nav aria-label="Review" className="flex shrink-0 items-center justify-around px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <DockButton label="Skip" onClick={onSkip} disabled={busy}>
        <SkipForward size={22} aria-hidden="true" />
      </DockButton>
      <button
        type="button"
        onClick={listening ? onDone : onTalk}
        disabled={phase === "drafting"}
        className={`bg-ink text-paper grid size-18 place-items-center rounded-full transition-[scale,opacity] duration-150 ease-knife active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-45 ${listening ? "animate-listening motion-reduce:animate-none" : ""}`}
      >
        {listening ? <Stop size={28} weight="fill" aria-hidden="true" /> : <Microphone size={30} weight="fill" aria-hidden="true" />}
        <span className="sr-only">{listening ? "Done talking" : "Talk about this preview"}</span>
      </button>
      <DockButton label="Looks good" onClick={onApprove} disabled={busy}>
        <Check size={22} weight="bold" aria-hidden="true" />
      </DockButton>
    </nav>
  );
}

type ListeningProps = { supported: boolean; text: string; onType: (text: string) => void; drafting: boolean };

function ListeningSheet({ supported, text, onType, drafting }: ListeningProps) {
  if (!supported) {
    return (
      <label className="flex flex-col gap-2">
        <span className="text-ink-soft text-sm">Type, or tap the keyboard&apos;s mic to talk</span>
        <textarea autoFocus value={text} onChange={(event) => onType(event.target.value)} rows={4} className="border-ink/15 bg-surface focus-visible:outline-ink rounded-xl border p-3 text-base focus-visible:outline-2" />
      </label>
    );
  }
  return (
    <div className="flex min-h-16 items-start gap-3">
      {drafting && <CircleNotch size={20} className="text-ink-soft mt-1 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      <p className={`text-lg text-pretty ${text ? "text-ink" : "text-ink-faint"} ${drafting ? "opacity-60" : ""}`}>{text || "Listening. Say what's wrong, then tap the button."}</p>
    </div>
  );
}

type CheckingProps = { draft: Draft; counting: boolean; sending: boolean; onEdit: (notes: TasteNote[]) => void; onSend: () => void; onStartOver: () => void };

function CheckingSheet({ draft, counting, sending, onEdit, onSend, onStartOver }: CheckingProps) {
  const setScope = (index: number, scope: TasteScope) => onEdit(draft.notes.map((note, at) => (at === index ? { ...note, scope } : note)));
  const remove = (index: number) => onEdit(draft.notes.filter((_, at) => at !== index));
  return (
    <div className="flex max-h-[70svh] flex-col gap-3">
      {draft.verdict === "approved" ? (
        <p className="flex items-center gap-3 text-lg font-medium">
          <KnifeStroke className="text-good h-4 w-12 shrink-0" />
          Looks good
        </p>
      ) : (
        <ul className="-mx-1 flex flex-col gap-2 overflow-y-auto overscroll-contain px-1 pb-1">
          {draft.notes.map((note, index) => (
            <NoteCard key={`${index}-${note.text}`} id={String(index)} note={note} onScope={(scope) => setScope(index, scope)} onRemove={() => remove(index)} />
          ))}
        </ul>
      )}
      <SendBar counting={counting} sending={sending} onSend={onSend} onStartOver={onStartOver} />
    </div>
  );
}

function useStatus() {
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 5000);
    return () => clearTimeout(timer);
  }, [status]);
  return [status, setStatus] as const;
}

/** One preview at a time, full screen: talk about it, check the notes, and they send themselves. */
export default function TasteReviewer({ initialQueue }: { initialQueue: TasteEntry[] }) {
  const [queue, setQueue] = useState(initialQueue);
  const [reviewed, setReviewed] = useState(0);
  const [phase, setPhase] = useState<Phase>("looking");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useStatus();
  const [problem, setProblem] = useState("");
  const dictation = useDictation();
  const entry = queue[0];

  const talk = () => {
    setStatus("");
    if (dictation.supported) dictation.start();
    else dictation.setText("");
    setPhase("listening");
  };

  const done = async () => {
    dictation.stop();
    const transcript = dictation.text.trim();
    if (!transcript) {
      setPhase("looking");
      setStatus("Nothing was heard. Tap the mic and try again.");
      return;
    }
    setPhase("drafting");
    const notes = await draftNotesAction(transcript, entry.businessName);
    if (!notes.length) {
      setPhase("looking");
      setStatus("That didn't sound like design notes. Try again.");
      return;
    }
    setDraft({ verdict: "changes", transcript, notes });
    setTouched(false);
    setPhase("checking");
  };

  const approve = () => {
    setStatus("");
    setDraft({ verdict: "approved", transcript: "", notes: [] });
    setTouched(false);
    setPhase("checking");
  };

  const startOver = () => {
    setProblem("");
    setDraft(null);
    setPhase("looking");
  };

  const send = useCallback(async () => {
    if (!draft || !entry) return;
    setPhase("sending");
    const result = await sendReviewAction({ jobId: entry.jobId, previewUrl: entry.previewUrl, ...draft });
    if (!result.saved) {
      setProblem("That review didn't save. Tap Send to try again.");
      setTouched(true);
      setPhase("checking");
      return;
    }
    setProblem("");
    setStatus(describeResult(entry.businessName, draft.verdict, result));
    setQueue((current) => current.slice(1));
    setReviewed((count) => count + 1);
    setDraft(null);
    setPhase("looking");
  }, [draft, entry, setStatus]);

  const edit = (notes: TasteNote[]) => {
    setTouched(true);
    if (!notes.length) return startOver();
    setDraft((current) => (current ? { ...current, notes } : current));
  };

  if (!entry) return <EmptyQueue />;
  const sheetOpen = phase !== "looking";

  return (
    <main className="bg-paper text-ink flex h-svh flex-col overflow-hidden">
      <Header entry={entry} position={reviewed + 1} total={reviewed + queue.length} />
      <PreviewFrame entry={entry} />
      <div className="relative mx-auto w-full max-w-lg shrink-0">
        <p role="status" className="pointer-events-none absolute inset-x-4 bottom-full mb-3 flex justify-center">
          {status && !sheetOpen && <span className="bg-ink text-paper shadow-lifted rounded-2xl px-4 py-2.5 text-sm text-pretty">{status}</span>}
        </p>
        {sheetOpen && (
          <section aria-label="Your notes" className="bg-paper shadow-lifted rounded-t-3xl px-4 pt-4 pb-2" onPointerDown={() => phase === "checking" && setTouched(true)}>
            {draft && (phase === "checking" || phase === "sending") ? (
              <CheckingSheet draft={draft} counting={!touched} sending={phase === "sending"} onEdit={edit} onSend={send} onStartOver={startOver} />
            ) : (
              <ListeningSheet supported={dictation.supported && !dictation.blocked} text={dictation.text} onType={dictation.setText} drafting={phase === "drafting"} />
            )}
            {problem && (
              <p role="alert" className="text-bad mt-2 text-sm">
                {problem}
              </p>
            )}
          </section>
        )}
        {(phase === "looking" || phase === "listening" || phase === "drafting") && (
          <Dock phase={phase} onSkip={() => setQueue(rotate)} onTalk={talk} onDone={done} onApprove={approve} />
        )}
      </div>
    </main>
  );
}
