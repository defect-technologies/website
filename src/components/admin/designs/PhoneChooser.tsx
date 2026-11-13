"use client";

import { ArrowsClockwise, ArrowSquareOut, GlobeHemisphereWest, Hammer, Keyboard, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { chooseBoardAction, redrawBoardsAction } from "@/app/admin/(panel)/designs/actions";
import { appendPhrase, useDictation } from "@/hooks/useDictation";
import type { BoardLetter, BoardOption } from "@/lib/boards";
import { DOCK_CARD, DockAction, DockMic, DockSideButton, DockSpoken, DockTypeField, useStopOnTouch } from "../dock";
import Segmented, { type Segment } from "../Segmented";
import { BoardPicture, DRAWN_AT, Letter, OptionFacts, Reach } from "./parts";
import WidePicture from "./WidePicture";

const NEW = "new";
type Slide = BoardLetter | typeof NEW;

type Props = { boardId: string; businessName: string; website: string; options: BoardOption[] };

/** A screen starts under the floating top bar, so the bar never covers the logo and menu of a first screen. */
const BELOW_TOP_BAR = "pt-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)]";

function OptionSlide({ option, website }: { option: BoardOption; website: string }) {
  const name = `Option ${option.letter.toUpperCase()}, ${option.name}`;
  return (
    <section aria-label={name} className={`w-full shrink-0 snap-center overflow-y-auto overscroll-y-contain pb-44 ${BELOW_TOP_BAR}`}>
      <BoardPicture src={option.pictures.phone} alt={`${name}: its first screen on a phone`} />
      <div className="flex flex-col gap-4 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-3">
            <Letter letter={option.letter} />
            <h2 className="truncate text-xl font-semibold">{option.name}</h2>
          </span>
          <Reach boldness={option.boldness} />
        </div>
        <p className="text-ink-soft text-pretty">{option.idea}</p>
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

function slidesOf(options: BoardOption[]): Segment<Slide>[] {
  return [...options.map((option) => ({ value: option.letter as Slide, label: option.letter.toUpperCase() })), { value: NEW, label: "New" }];
}

/**
 * Choosing a lead's design on a phone. Each option is a screen to swipe to, with its first screen as a visitor's phone
 * shows it, then its idea, colours, type and the wide pictures. The dock builds the option in view, after a countdown
 * any touch stops, with what the founder said or typed. The last screen asks for three new designs.
 */
export default function PhoneChooser({ boardId, businessName, website, options }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const slides = slidesOf(options);
  const [slide, setSlide] = useState<Slide>(slides[0].value);
  const [note, setNote] = useState("");
  const [everySite, setEverySite] = useState(false);
  const [typing, setTyping] = useState(false);
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const dictation = useDictation((phrase) => setNote((current) => appendPhrase(current, phrase)));
  useStopOnTouch(armed, () => setArmed(false));

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

  const decide = () => {
    const form = new FormData();
    form.set("id", boardId);
    form.set("feedback", note);
    if (slide !== NEW) form.set("letter", slide);
    if (everySite) form.set("remember", "on");
    dictation.stop();
    startTransition(() => (slide === NEW ? redrawBoardsAction(form) : chooseBoardAction(form)));
  };
  /** The first tap starts the countdown, and a second one decides at once. */
  const press = () => {
    if (!armed) return setArmed(true);
    setArmed(false);
    decide();
  };

  const drawing = slide === NEW;
  const letter = drawing ? "" : slide.toUpperCase();
  return (
    <div className="bg-paper fixed inset-0 z-20 flex flex-col lg:hidden">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="bg-paper/95 text-ink shadow-lifted pointer-events-auto flex min-h-11 min-w-0 items-center rounded-full pr-4 backdrop-blur">
          <Link href="/admin/designs" className="focus-visible:outline-ink grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2">
            <X size={18} aria-hidden="true" />
            <span className="sr-only">Close and go back to Designs</span>
          </Link>
          <h1 className="min-w-0 truncate text-sm font-semibold">{businessName}</h1>
        </div>
        <div className="shadow-lifted pointer-events-auto shrink-0 rounded-full">
          <Segmented label="Design in view" options={slides} value={slide} onChange={show} />
        </div>
      </div>
      <div ref={track} onScroll={onScroll} className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]">
        {options.map((option) => (
          <OptionSlide key={option.letter} option={option} website={website} />
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
        {!typing && note.trim() && !dictation.listening && <NoteCard note={note} everySite={everySite} onEdit={() => setTyping(true)} />}
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
          <DockAction
            icon={drawing ? <ArrowsClockwise size={20} aria-hidden="true" /> : <Hammer size={20} aria-hidden="true" />}
            label={drawing ? "Draw 3 new" : `Build ${letter}`}
            armedLabel={(left) => (drawing ? `Drawing in ${left}` : `Building ${letter} in ${left}`)}
            pending={pending}
            armed={armed}
            onPress={press}
          />
        </div>
      </div>
    </div>
  );
}
