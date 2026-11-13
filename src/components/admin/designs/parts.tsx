import { Check } from "@phosphor-icons/react/dist/ssr";
import type { CSSProperties } from "react";
import type { BoardOption } from "@/lib/boards";

/** The widths in pixels the runner draws an option's wide pictures at (site-kit, packages/kit/src/boards/render.ts). */
export const DRAWN_AT = { board: 1600, desktop: 1440 } as const;

const REACH: Record<number, string> = { 1: "Close to how they look today", 2: "A step away from today", 3: "Far from how they look today" };

/** How far an option goes from how the business looks today, as three steps with the reached ones filled. */
export function Reach({ boldness }: { boldness: number }) {
  return (
    <span role="img" aria-label={REACH[boldness] ?? REACH[2]} title={REACH[boldness] ?? REACH[2]} className="flex shrink-0 gap-1">
      {[1, 2, 3].map((step) => (
        <span key={step} className={`h-1.5 w-5 ${step <= boldness ? "bg-ink" : "bg-ink/15"}`} />
      ))}
    </span>
  );
}

/** The option's letter. In a chooser it turns into a check when its option is selected. */
export function Letter({ letter, chosen = false, selectable = false }: { letter: string; chosen?: boolean; selectable?: boolean }) {
  const mark = <Check size={18} weight="bold" aria-hidden="true" />;
  return (
    <span className={`relative grid size-9 shrink-0 place-items-center rounded-full font-semibold ${chosen ? "bg-good text-paper" : "bg-ink text-paper"}`}>
      {chosen ? mark : <span className={selectable ? "group-has-[:checked]:opacity-0" : ""}>{letter.toUpperCase()}</span>}
      {selectable && <span className="absolute inset-0 grid place-items-center opacity-0 group-has-[:checked]:opacity-100">{mark}</span>}
    </span>
  );
}

const PALETTE_ORDER = ["background", "surface", "ink", "inkMuted", "accent", "onAccent", "line"];

/** The option's seven colours as a strip, in the order a page uses them. */
export function Palette({ option }: { option: BoardOption }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 overflow-hidden rounded-full outline-1 -outline-offset-1 outline-black/10">
      {PALETTE_ORDER.filter((key) => option.palette[key]).map((key) => (
        <span key={key} className="h-5 w-5" style={{ backgroundColor: option.palette[key] }} />
      ))}
    </span>
  );
}

/** A picture of a board or of its first screen. The outline keeps a white page from melting into the card. */
export function BoardPicture({ src, alt, className = "", style }: { src: string; alt: string; className?: string; style?: CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element -- the pictures are in the admin's own blob store, as the brand files are
  return <img src={src} alt={alt} loading="lazy" style={style} className={`block w-full outline-1 -outline-offset-1 outline-black/10 ${className}`} />;
}

/**
 * An option's first screen on a desktop, with the same screen on a phone standing in its corner: the two a visitor
 * can meet it on, in one look.
 */
export function FirstScreens({ option }: { option: BoardOption }) {
  const name = `option ${option.letter.toUpperCase()}, ${option.name}`;
  return (
    <span className="relative block pb-6">
      <BoardPicture src={option.pictures.desktop} alt={`The first screen of ${name}, on a desktop`} className="aspect-[16/10] rounded-lg object-cover object-top" />
      <span className="shadow-lifted absolute right-3 bottom-0 block w-[22%] rounded-lg">
        <BoardPicture src={option.pictures.phone} alt={`The first screen of ${name}, on a phone`} className="aspect-[390/844] rounded-lg object-cover object-top" />
      </span>
    </span>
  );
}

export function OptionFacts({ option }: { option: BoardOption }) {
  return (
    <span className="text-ink-soft flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <Palette option={option} />
      <span>{option.fonts.heading === option.fonts.body ? option.fonts.heading : `${option.fonts.heading} with ${option.fonts.body}`}</span>
    </span>
  );
}
