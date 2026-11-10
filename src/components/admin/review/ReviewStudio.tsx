"use client";

import { ArrowSquareOut, CaretLeft, CaretRight, Check, CircleNotch, Desktop, DeviceMobile, PaperPlaneTilt } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { approveReviewAction, sendReviewAction, type ReviewResult } from "@/app/admin/(panel)/review/studioActions";
import { useDictation } from "@/hooks/useDictation";
import { useHydrated } from "@/hooks/useHydrated";
import { useReviewBridge } from "@/hooks/useReviewBridge";
import type { Device, NoteAnchor, ReviewNote } from "@/lib/review";
import { Button, buttonClasses } from "../../Button";
import { askAnchor } from "@/lib/reviewAsks";
import AskCard from "./AskCard";
import NoteComposer from "./NoteComposer";
import NoteList from "./NoteList";
import PhoneDock from "./PhoneDock";
import { Key } from "./NoteParts";
import PreviewStage from "./PreviewStage";
import { appendPhrase, type Draft, EMPTY_DRAFT, isTyping, noteFromDraft, readSavedNotes, saveNotes } from "./reviewDraft";
import { useAskFlow } from "./useAskFlow";
import { usePhoneReview } from "./usePhoneReview";
import { useReviewAsks } from "./useReviewAsks";

export type StudioItem = { id: string; businessName: string; website: string; previewUrl: string; held: boolean };

type Props = { item: StudioItem; position: number; total: number; previousId: string | null; nextId: string | null };

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function DeviceSwitch({ device, onChange }: { device: Device; onChange: (device: Device) => void }) {
  const options: { value: Device; label: string; icon: typeof Desktop }[] = [
    { value: "desktop", label: "Desktop", icon: Desktop },
    { value: "phone", label: "Phone", icon: DeviceMobile },
  ];
  return (
    <div role="group" aria-label="Preview width" className="bg-paper-shade flex rounded-full p-1">
      {options.map(({ value, label, icon: OptionIcon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={device === value}
          onClick={() => onChange(value)}
          className={`focus-visible:outline-ink inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-2 ${device === value ? "bg-surface text-ink shadow-card" : "text-ink-soft hover:text-ink"}`}
        >
          <OptionIcon size={18} weight={device === value ? "fill" : "regular"} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

function QueueSteps({ position, total, previousId, nextId }: Omit<Props, "item">) {
  const step = (id: string | null, label: string, icon: React.ReactNode) =>
    id ? (
      <Link href={`/admin/review?id=${id}`} aria-label={label} className={buttonClasses("ghost", "icon")}>
        {icon}
      </Link>
    ) : (
      <span aria-hidden="true" className="size-10" />
    );
  return (
    <div className="flex items-center gap-1">
      {step(previousId, "Previous preview", <CaretLeft size={18} weight="bold" aria-hidden="true" />)}
      <span className="text-ink-soft min-w-14 text-center text-sm tabular-nums">
        {position} of {total}
      </span>
      {step(nextId, "Skip to the next preview", <CaretRight size={18} weight="bold" aria-hidden="true" />)}
    </div>
  );
}

function StudioBar({ item, ...queue }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display min-w-0 truncate text-4xl leading-none font-black">{item.businessName}</h1>
        {item.held && <span className="text-warn text-sm font-medium">Held from outreach until approved</span>}
        {item.website && (
          <a href={item.website} target="_blank" rel="noreferrer" className="text-ink-soft hover:text-ink inline-flex items-center gap-1 text-sm underline decoration-ink/25 underline-offset-4">
            Their current site
            <ArrowSquareOut size={14} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
      <QueueSteps {...queue} />
    </header>
  );
}

function AddressBar({ previewUrl, path, device, onDevice }: { previewUrl: string; path: string; device: Device; onDevice: (device: Device) => void }) {
  return (
    <div className="flex items-center gap-3">
      <DeviceSwitch device={device} onChange={onDevice} />
      <a
        href={new URL(path, previewUrl).toString()}
        target="_blank"
        rel="noreferrer"
        title="Open this page in a new tab"
        className="bg-surface shadow-card text-ink-soft hover:text-ink flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-full px-4 text-sm"
      >
        <span className="min-w-0 flex-1 truncate">
          {hostOf(previewUrl)}
          <span className="text-ink">{path === "/" ? "" : path}</span>
        </span>
        <ArrowSquareOut size={14} aria-hidden="true" className="shrink-0" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  );
}

function Verdict({ count, pending, onSubmit }: { count: number; pending: boolean; onSubmit: () => void }) {
  const icon = pending ? <CircleNotch size={18} weight="bold" className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : count ? <PaperPlaneTilt size={18} aria-hidden="true" /> : <Check size={18} weight="bold" aria-hidden="true" />;
  return (
    <Button variant="solid" className="w-full" disabled={pending} aria-busy={pending} onClick={onSubmit} icon={icon}>
      {count ? `Send ${count} ${count === 1 ? "note" : "notes"} to the builder` : "Approve as it is"}
      <span className="bg-paper/15 text-paper hidden rounded px-1 text-xs lg:inline-block">⌘↵</span>
    </Button>
  );
}

function useStudioShortcuts(actions: { point: () => void; stopPointing: () => void; talk: () => void; submit: () => void }) {
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        latest.current.submit();
        return;
      }
      if (event.key === "Escape") latest.current.stopPointing();
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "p") latest.current.point();
      if (key === "m") latest.current.talk();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function useNotes(item: StudioItem) {
  const [notes, setNotes] = useState<ReviewNote[]>(() => readSavedNotes(item.id, item.previewUrl));
  useEffect(() => saveNotes(item.id, item.previewUrl, notes), [item.id, item.previewUrl, notes]);
  const change = useCallback((id: string, change: Partial<ReviewNote>) => setNotes((all) => all.map((note) => (note.id === id ? { ...note, ...change } : note))), []);
  const remove = useCallback((id: string) => setNotes((all) => all.filter((note) => note.id !== id)), []);
  const add = useCallback((note: ReviewNote) => setNotes((all) => [...all, note]), []);
  return { notes, setNotes, change, remove, add };
}

function Studio({ item, ...queue }: Props) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const [device, setDevice] = useState<Device>(() => (window.matchMedia("(width < 64rem)").matches ? "phone" : "desktop"));
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [pointing, setPointing] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const { notes, change, remove, add } = useNotes(item);
  const live = useRef({ draft, pointing, device, path: "/" });
  const stage = useRef<HTMLElement>(null);
  // On a phone the admin nav fills the first screen, so the preview scrolls up to meet the dock.
  useEffect(() => {
    if (window.matchMedia("(width < 64rem)").matches) stage.current?.scrollIntoView({ block: "start" });
  }, []);

  const onPicked = useCallback(
    (anchor: NoteAnchor) => {
      const { draft: current, device: width, path } = live.current;
      setArmed(false);
      if (current.text.trim()) add(noteFromDraft(current, width, path));
      setDraft({ text: "", anchor, pickedOn: width, scope: current.text.trim() ? "site" : current.scope });
      field.current?.focus({ preventScroll: true });
    },
    [add],
  );
  const bridge = useReviewBridge(frame, item.previewUrl, { onPicked, onPickCancelled: () => setPointing(false) });
  useEffect(() => {
    live.current = { draft, pointing, device, path: bridge.path };
  });
  const { state: bridgeState, setPicking } = bridge;
  // The bridge turns pointing off after each pick, so it's turned back on after every new anchor while pointing.
  useEffect(() => {
    if (bridgeState === "connected") setPicking(pointing);
  }, [bridgeState, setPicking, pointing, draft.anchor]);

  const dictation = useDictation((phrase) => setDraft((current) => ({ ...current, text: appendPhrase(current.text, phrase) })));

  const asks = useReviewAsks(item.id, item.previewUrl, queue.nextId);
  // On a phone the last answer starts the send countdown; on a desktop the founder sends with the button.
  const flow = useAskFlow(asks.asks, () => window.matchMedia("(width < 64rem)").matches && setArmed(true));
  const currentAsk = flow.current;
  // Until the founder points somewhere else, a note answers the open question about its element.
  const target: Draft = draft.anchor || !currentAsk ? draft : { ...draft, anchor: askAnchor(currentAsk) };
  const { show } = bridge;
  useEffect(() => {
    if (bridgeState === "connected" && currentAsk?.selector) show(currentAsk);
  }, [bridgeState, show, currentAsk]);

  const addDraft = () => {
    if (!target.text.trim()) return;
    add(noteFromDraft(target, device, bridge.path));
    setDraft({ ...EMPTY_DRAFT });
    if (currentAsk) flow.noted();
  };

  const submit = () => {
    if (pending) return;
    const all = target.text.trim() ? [...notes, noteFromDraft(target, device, bridge.path)] : notes;
    const input = { businessId: item.id, previewUrl: item.previewUrl, notes: all };
    startTransition(async () => {
      const outcome = all.length ? await sendReviewAction(input) : await approveReviewAction(input);
      setResult(outcome);
      if (!outcome.ok) return;
      dictation.stop();
      saveNotes(item.id, item.previewUrl, []);
      router.replace(queue.nextId ? `/admin/review?id=${queue.nextId}` : "/admin/review");
      router.refresh();
    });
  };

  useStudioShortcuts({ point: () => bridge.state === "connected" && setPointing((on) => !on), stopPointing: () => setPointing(false), talk: dictation.toggle, submit });
  const count = notes.length + (draft.text.trim() ? 1 : 0);
  const phone = usePhoneReview({ draft: target, setDraft, dictation, add, device, path: bridge.path, count, armed, setArmed, submit, ask: { open: Boolean(currentAsk), answered: flow.noted } });

  return (
    <div className="flex flex-col gap-4 pb-40 lg:-mb-16 lg:h-[calc(100svh-4rem)] lg:pb-0">
      <StudioBar item={item} {...queue} />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section ref={stage} aria-label="Preview" className="flex h-[calc(100svh-var(--phone-dock-height,9rem))] min-h-0 flex-col gap-3 lg:h-auto">
          <AddressBar previewUrl={item.previewUrl} path={bridge.path} device={device} onDevice={setDevice} />
          <PreviewStage frame={frame} previewUrl={item.previewUrl} businessName={item.businessName} device={device} pointing={pointing} onLoad={bridge.greet} />
        </section>
        <aside aria-label="Notes" className="bg-surface shadow-card flex min-h-0 flex-col overflow-hidden rounded-2xl">
          <AskCard state={asks} flow={flow} className="border-ink/8 hidden border-b p-4 lg:flex" />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {notes.length ? <NoteList notes={notes} onChange={change} onRemove={remove} /> : <NoNotesYet />}
          </div>
          <div className="border-ink/8 border-t">
            <NoteComposer field={field} draft={target} path={bridge.path} bridge={bridge.state} pointing={pointing} dictation={dictation} onDraft={setDraft} onPoint={() => setPointing((on) => !on)} onAdd={addDraft} />
          </div>
          <div className="hidden flex-col gap-2 px-4 pb-4 lg:flex">
            <Verdict count={count} pending={pending} onSubmit={submit} />
            <p role="status" className={`min-h-5 text-sm ${result?.ok === false ? "text-bad font-medium" : "text-ink-faint"}`}>
              {result?.message ?? ""}
            </p>
          </div>
        </aside>
      </div>
      <PhoneDock
        pointing={pointing}
        canPoint={bridge.state === "connected"}
        onPoint={() => setPointing((on) => !on)}
        talk={{ supported: dictation.supported, listening: dictation.listening, onToggle: phone.toggleTalk }}
        spoken={`${draft.text} ${dictation.interim}`.trim()}
        splitting={phone.splitting}
        problem={result?.ok === false ? result.message : dictation.error}
        count={count}
        pending={pending}
        armed={armed}
        onSubmit={phone.tapSend}
        ask={<AskCard state={asks} flow={flow} />}
      />
    </div>
  );
}

function NoNotesYet() {
  return (
    <div className="text-ink-soft flex h-full min-h-32 flex-col justify-end gap-2 p-4 text-sm text-pretty">
      <p className="hidden flex-wrap items-center gap-1.5 lg:flex">
        Press <Key>P</Key> and click anything in the preview, then <Key>M</Key> and talk.
      </p>
      <p className="lg:hidden">Tap Point at it, tap the part of the preview you mean, then Talk or type.</p>
    </div>
  );
}

/** Saved notes come from this browser's storage, so the studio only renders once the page is in the browser. */
export default function ReviewStudio(props: Props) {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="lg:h-[calc(100svh-4rem)]" />;
  return <Studio {...props} />;
}
