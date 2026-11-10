"use client";

import { ArrowSquareOut, CaretLeft, CaretRight, Check, CircleNotch, Desktop, DeviceMobile, PaperPlaneTilt, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { addPointingAction, approveReviewAction, sendReviewAction, type ReviewResult } from "@/app/admin/(panel)/review/studioActions";
import { useDictation } from "@/hooks/useDictation";
import { useHydrated } from "@/hooks/useHydrated";
import { type BridgeState, useReviewBridge } from "@/hooks/useReviewBridge";
import type { Device, NoteAnchor, ReviewNote } from "@/lib/review";
import { Button, buttonClasses } from "../../Button";
import { askAnchor, samePage } from "@/lib/reviewAsks";
import AskCard from "./AskCard";
import NoteComposer from "./NoteComposer";
import NoteList from "./NoteList";
import PhoneDock, { CARD } from "./PhoneDock";
import PhoneTopBar from "./PhoneTopBar";
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
    <header className="flex items-center justify-between gap-x-6 max-lg:hidden">
      <div className="flex min-w-0 items-center gap-x-4">
        <Link href="/admin" className={buttonClasses("ghost", "icon")}>
          <X size={20} aria-hidden="true" />
          <span className="sr-only">Close review and go back to Today</span>
        </Link>
        <h1 className="font-display min-w-0 truncate text-3xl leading-none font-black">{item.businessName}</h1>
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

/** What the dock shows above its buttons: the last result, or why the mic can't be used. */
function dockNotice(result: ReviewResult | null, micError: string) {
  if (result?.message) return { text: result.message, bad: !result.ok };
  return micError ? { text: micError, bad: true } : null;
}

type PointOptions = {
  bridgeState: BridgeState;
  businessId: string;
  /** Notes not sent yet would be lost when the rebuild replaces this preview. */
  hasNotes: boolean;
  setPointing: (update: (on: boolean) => boolean) => void;
  setResult: (result: ReviewResult) => void;
  startTransition: (work: () => Promise<void>) => void;
  leave: () => void;
};

/** Points when the preview can; a preview built before pointing worked is rebuilt on the newest kit instead. */
function pointHandler({ bridgeState, businessId, hasNotes, setPointing, setResult, startTransition, leave }: PointOptions) {
  return () => {
    if (bridgeState === "connected") return setPointing((on) => !on);
    if (bridgeState === "connecting") return setResult({ ok: false, message: "Still connecting to the preview. Try again in a moment." });
    if (hasNotes) return setResult({ ok: false, message: "This preview can't point yet. Send your notes: their rebuild adds pointing." });
    startTransition(async () => {
      const outcome = await addPointingAction(businessId);
      setResult(outcome);
      if (outcome.ok) window.setTimeout(leave, 2500);
    });
  };
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
  const [notesOpen, setNotesOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { notes, change, remove, add } = useNotes(item);
  const live = useRef({ draft, pointing, device, path: "/" });

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
  const shownAsk = useRef<string | null>(null);
  const onAskPage = Boolean(currentAsk) && samePage(bridge.path, currentAsk?.path ?? "");
  // A new question takes the preview to its element. Once there, the element is marked again whenever the founder
  // comes back to that page, but wandering off to another page never pulls them back.
  useEffect(() => {
    if (bridgeState !== "connected" || !currentAsk?.selector) return;
    if (shownAsk.current === currentAsk.id && !onAskPage) return;
    shownAsk.current = currentAsk.id;
    show(currentAsk);
  }, [bridgeState, show, currentAsk, onAskPage]);

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

  const nextHref = queue.nextId ? `/admin/review?id=${queue.nextId}` : "/admin/review";
  const point = pointHandler({ bridgeState: bridge.state, businessId: item.id, hasNotes: notes.length > 0 || Boolean(draft.text.trim()), setPointing, setResult, startTransition, leave: () => router.replace(nextHref) });

  useStudioShortcuts({ point, stopPointing: () => setPointing(false), talk: dictation.toggle, submit });
  const count = notes.length + (draft.text.trim() ? 1 : 0);
  const phone = usePhoneReview({ draft: target, setDraft, dictation, add, device, path: bridge.path, count, armed, setArmed, submit, ask: { open: Boolean(currentAsk), answered: flow.noted } });

  return (
    <div className="bg-paper fixed inset-0 z-20 flex flex-col gap-3 lg:p-4">
      <StudioBar item={item} {...queue} />
      <PhoneTopBar item={item} position={queue.position} total={queue.total} nextId={queue.nextId} notes={count} notesOpen={notesOpen} onNotes={() => setNotesOpen((open) => !open)} />
      <div className="relative grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Preview" className="flex min-h-0 flex-col gap-3 max-lg:absolute max-lg:inset-0">
          <div className="max-lg:hidden">
            <AddressBar previewUrl={item.previewUrl} path={bridge.path} device={device} onDevice={setDevice} />
          </div>
          <PreviewStage frame={frame} previewUrl={item.previewUrl} businessName={item.businessName} device={device} pointing={pointing} onLoad={bridge.greet} />
        </section>
        <aside
          aria-label="Notes"
          className={`bg-surface shadow-card flex min-h-0 flex-col overflow-hidden rounded-2xl ${notesOpen ? "max-lg:fixed max-lg:inset-x-3 max-lg:top-[calc(env(safe-area-inset-top)+4.5rem)] max-lg:bottom-3 max-lg:z-40 max-lg:shadow-lifted" : "max-lg:hidden"}`}
        >
          <AskCard state={asks} flow={flow} className="border-ink/8 hidden border-b p-4 lg:flex" />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {notes.length ? <NoteList notes={notes} onChange={change} onRemove={remove} /> : <NoNotesYet />}
          </div>
          <div className="border-ink/8 border-t">
            <NoteComposer field={field} draft={target} path={bridge.path} bridge={bridge.state} pointing={pointing} dictation={dictation} onDraft={setDraft} onPoint={point} onAdd={addDraft} />
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
        onPoint={point}
        typing={{ text: draft.text, onChange: (text) => setDraft((current) => ({ ...current, text })), onAdd: addDraft }}
        talk={{ supported: dictation.supported, listening: dictation.listening, onToggle: phone.toggleTalk }}
        spoken={`${draft.text} ${dictation.interim}`.trim()}
        splitting={phone.splitting}
        notice={dockNotice(result, dictation.error)}
        count={count}
        pending={pending}
        armed={armed}
        onSubmit={phone.tapSend}
        ask={<AskCard state={asks} flow={flow} className={CARD} />}
      />
    </div>
  );
}

function NoNotesYet() {
  return (
    <div className="text-ink-soft flex h-full min-h-32 flex-col justify-end gap-2 p-4 text-sm text-pretty">
      <p className="hidden lg:block">
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
