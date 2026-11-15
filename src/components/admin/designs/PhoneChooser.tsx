"use client";

import { ArrowsClockwise, ArrowSquareOut, GlobeHemisphereWest, Hammer, Keyboard, PencilSimpleLine, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { chooseBoardAction, redrawBoardsAction, reviseBoardAction } from "@/app/admin/(panel)/designs/actions";
import { appendPhrase, useDictation } from "@/hooks/useDictation";
import type { BoardLetter, BoardOption } from "@/lib/boards";
import { DOCK_CARD, DockAction, DockConfirm, DockMic, DockSideButton, DockSpoken, DockTypeField, useCloseOnTouchElsewhere } from "../dock";
import Segmented, { type Segment } from "../Segmented";
import { BoardPicture, DRAWN_AT, Letter, OptionFacts, Reach } from "./parts";
import WidePicture from "./WidePicture";

const NEW = "new";
type Slide = BoardLetter | typeof NEW;

/** For three revisions of an earlier option: which option they revise and what the founder asked for. */
type Revision = { letter: string; name: string; feedback: string };

type Props = { boardId: string; businessName: string; website: string; options: BoardOption[]; revision: Revision | null };

/** A screen starts under the floating top bar, so the bar never covers the logo and menu of a first screen. */
const BELOW_TOP_BAR = "pt-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)]";

function OptionSlide({ option, website, revision }: { option: BoardOption; website: string; revision: Revision | null }) {
  const name = `Option ${option.letter.toUpperCase()}, ${option.name}`;
  return (
    <section aria-label={name} className={`w-full shrink-0 snap-center overflow-y-auto overscroll-y-contain pb-44 ${BELOW_TOP_BAR}`}>
      {option.pictures.pagePhone ? (
        <BoardPicture src={option.pictures.pagePhone} alt={`${name}: its whole home page on a phone`} />
      ) : (
        <BoardPicture src={option.pictures.phone} alt={`${name}: its first screen on a phone`} />
      )}
      <div className="flex flex-col gap-4 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-3">
            <Letter letter={option.letter} />
            <h2 className="truncate text-xl font-semibold">{option.name}</h2>
          </span>
          <Reach boldness={option.boldness} />
        </div>
        {revision && (
          <p className="text-ink-soft text-sm text-pretty">
            <span className="text-ink font-medium">
              Revision of {revision.letter.toUpperCase()}, {revision.name}:
            </span>{" "}
            {revision.feedback}
          </p>
        )}
        <p className="text-ink-soft text-pretty">{option.idea}</p>
        {option.composition && <p className="text-ink-soft text-sm text-pretty">{option.composition}</p>}
        <OptionFacts option={option} />
        {website && (
          <a href={website} target="_blank" rel="noreferrer" className="text-ink-soft inline-flex min-h-11 w-fit items-center gap-1.5 text-sm underline decoration-ink/25 underline-offset-4">
            Their site today
            <ArrowSquareOut size={14} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <WidePicture src={option.pictures.desktop} alt={`${name}: its first screen on a desktop`} madeAt={DRAWN_AT.desktop} />
        <WholeBoard option={option} name={name} />
      </div>
    </section>
  );
}

/** The option's board. A newer kit pictures it in one column for a phone; an older board is the wide one, scrolled sideways. */
function WholeBoard({ option, name }: { option: BoardOption; name: string }) {
  const alt = `${name}: its colours, type, buttons, photos, logo and motif`;
  if (option.pictures.narrow) return <BoardPicture src={option.pictures.narrow} alt={alt} />;
  return <WidePicture src={option.pictures.board} alt={alt} madeAt={DRAWN_AT.board} />;
}

function NewSlide({ businessName }: { businessName: string }) {
  return (
    <section aria-label="Three new designs" className={`grid w-full shrink-0 snap-center place-items-center overflow-y-auto px-6 pb-44 ${BELOW_TOP_BAR}`}>
      <div className="flex max-w-sm flex-col gap-3">
        <ArrowsClockwise size={40} aria-hidden="true" className="text-ink-soft" />
        <h2 className="text-2xl font-semibold text-balance">Three new designs</h2>
        <p className="text-ink-soft text-pretty">The builder draws three more for {businessName}. It follows what you say or type first.</p>
      </div>
    </section>
  );
}

/** What the founder wants changed, shown above the dock once it is said or typed. Tapping it opens the keyboard. */
function NoteCard({ note, everySite, onEdit }: { note: string; everySite: boolean; onEdit: () => void }) {
  return (
    <button type="button" onClick={onEdit} className={`${DOCK_CARD} focus-visible:outline-ink flex flex-col gap-1 text-left focus-visible:outline-2`}>
      <span className="line-clamp-3 text-base">{note}</span>
      {everySite && (
        <span className="text-ink-soft inline-flex items-center gap-1.5 text-sm">
          <GlobeHemisphereWest size={14} aria-hidden="true" />
          For every site
        </span>
      )}
      <span className="sr-only">Change this note</span>
    </button>
  );
}

/** What the founder is about to decide, with the option's first screen and their note, so the second tap is an informed one. */
function DecisionPreview({ option, businessName, note }: { option: BoardOption | undefined; businessName: string; note: string }) {
  const words = note.trim();
  if (!option) return <p className="text-ink-soft text-pretty">{words ? `The builder draws three more for ${businessName} and follows your note: ${words}` : `The builder draws three more for ${businessName}.`}</p>;
  return (
    <div className="flex items-start gap-3">
      <span className="w-14 shrink-0">
        <BoardPicture src={option.pictures.phone} alt="" className="aspect-[390/844] rounded-md object-cover object-top" />
      </span>
      <p className={`line-clamp-5 text-sm text-pretty ${words ? "text-ink" : "text-ink-soft"}`}>{words || "No note. The site is built from this design as it is."}</p>
    </div>
  );
}

function slidesOf(options: BoardOption[]): Segment<Slide>[] {
  return [...options.map((option) => ({ value: option.letter as Slide, label: option.letter.toUpperCase() })), { value: NEW, label: "New" }];
}

/** What the dock's button and its confirm card say for the screen in view. With a note, an option can be revised first. */
function decisionFor(slide: Slide, options: BoardOption[], hasNote: boolean) {
  if (slide === NEW) return { letter: "", inView: undefined, icon: <ArrowsClockwise size={20} aria-hidden="true" />, label: "Draw 3 new", title: "Draw three new designs?", revisable: false };
  const letter = slide.toUpperCase();
  const inView = options.find((option) => option.letter === slide);
  const named = `${letter}, ${inView?.name ?? "this design"}`;
  return {
    letter,
    inView,
    icon: <Hammer size={20} aria-hidden="true" />,
    label: `Build ${letter}`,
    title: hasNote ? `${named}: build it, or revise it first?` : `Build ${named}?`,
    revisable: hasNote,
  };
}

/** Closes the chooser, names the business and switches between the options and the last screen. */
function TopBar({ businessName, slides, slide, onShow }: { businessName: string; slides: Segment<Slide>[]; slide: Slide; onShow: (next: Slide) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="bg-paper/95 text-ink shadow-lifted pointer-events-auto flex min-h-11 min-w-0 items-center rounded-full pr-4 backdrop-blur">
        <Link href="/admin/designs" className="focus-visible:outline-ink grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2">
          <X size={18} aria-hidden="true" />
          <span className="sr-only">Close and go back to Designs</span>
        </Link>
        <h1 className="min-w-0 truncate text-sm font-semibold">{businessName}</h1>
      </div>
      <div className="shadow-lifted pointer-events-auto shrink-0 rounded-full">
        <Segmented label="Design in view" options={slides} value={slide} onChange={onShow} />
      </div>
    </div>
  );
}

/** The track of screens to swipe through, and which one is in view. */
function useSlides(slides: Segment<Slide>[]) {
  const track = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState<Slide>(slides[0].value);
  const show = (next: Slide) => {
    const element = track.current;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (element) element.scrollTo({ left: slides.findIndex((entry) => entry.value === next) * element.clientWidth, behavior: calm ? "instant" : "smooth" });
  };
  const onScroll = () => {
    const element = track.current;
    if (!element || !element.clientWidth) return;
    const inView = slides[Math.round(element.scrollLeft / element.clientWidth)]?.value;
    if (inView && inView !== slide) setSlide(inView);
  };
  return { track, slide, show, onScroll };
}

/**
 * Choosing a lead's design on a phone. Each option is a screen to swipe to, with its first screen as a visitor's phone
 * shows it, then its idea, colours, type and the wide pictures. The dock's button asks to confirm the option in view,
 * with what the founder said or typed, and only the confirm builds it. The last screen asks for three new designs.
 */
export default function PhoneChooser({ boardId, businessName, website, options, revision }: Props) {
  const slides = slidesOf(options);
  const { track, slide, show, onScroll } = useSlides(slides);
  const [note, setNote] = useState("");
  const [everySite, setEverySite] = useState(false);
  const [typing, setTyping] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const dictation = useDictation((phrase) => setNote((current) => appendPhrase(current, phrase)));
  useCloseOnTouchElsewhere(confirming, () => setConfirming(false));

  /** Builds the option in view, or with `revise` has it revised with the note first. The last screen draws three new. */
  const decide = (revise = false) => {
    const form = new FormData();
    form.set("id", boardId);
    form.set("feedback", note);
    if (slide !== NEW) form.set("letter", slide);
    if (everySite) form.set("remember", "on");
    dictation.stop();
    const action = slide === NEW ? redrawBoardsAction : revise ? reviseBoardAction : chooseBoardAction;
    startTransition(() => action(form));
  };
  const askToConfirm = () => {
    dictation.stop();
    setTyping(false);
    setConfirming(true);
  };

  const decision = decisionFor(slide, options, Boolean(note.trim()));
  const revise = decision.revisable ? { label: `Revise ${decision.letter}`, icon: <PencilSimpleLine size={18} aria-hidden="true" />, onPress: () => decide(true) } : undefined;
  return (
    <div className="bg-paper fixed inset-0 z-20 flex flex-col lg:hidden">
      <TopBar businessName={businessName} slides={slides} slide={slide} onShow={show} />
      <div ref={track} onScroll={onScroll} className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]">
        {options.map((option) => (
          <OptionSlide key={option.letter} option={option} website={website} revision={revision} />
        ))}
        <NewSlide businessName={businessName} />
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {typing && (
          <DockTypeField id="design-note" label="What should change" text={note} onChange={setNote} onKeep={() => setTyping(false)} keepLabel="Keep this note">
            <label className="text-ink-soft flex min-h-9 w-fit cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={everySite} onChange={(event) => setEverySite(event.target.checked)} className="accent-ink size-4 shrink-0" />
              Remember this for every site
            </label>
          </DockTypeField>
        )}
        {confirming && (
          <DockConfirm
            title={decision.title}
            icon={decision.icon}
            confirmLabel={decision.label}
            pending={pending}
            onConfirm={() => decide()}
            onCancel={() => setConfirming(false)}
            alternative={revise}
          >
            <DecisionPreview option={decision.inView} businessName={businessName} note={note} />
          </DockConfirm>
        )}
        {!confirming && !typing && note.trim() && !dictation.listening && <NoteCard note={note} everySite={everySite} onEdit={() => setTyping(true)} />}
        <div aria-live="polite" className="empty:hidden">
          <DockSpoken spoken={`${note} ${dictation.interim}`.trim()} listening={dictation.listening} notice={dictation.error ? { text: dictation.error, bad: true } : null} />
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <DockSideButton label="Type" on={typing} onClick={() => setTyping((open) => !open)}>
            <Keyboard size={22} aria-hidden="true" />
          </DockSideButton>
          <span className="flex flex-1 justify-center">
            <DockMic talk={{ supported: dictation.supported, listening: dictation.listening, onToggle: dictation.toggle }} label="Say what should change" />
          </span>
          <DockAction icon={decision.icon} label={decision.label} pending={pending} onPress={askToConfirm} />
        </div>
      </div>
    </div>
  );
}
