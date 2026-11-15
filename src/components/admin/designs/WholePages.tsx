import type { BoardOption } from "@/lib/boards";
import { BoardPicture, Letter } from "./parts";

/**
 * Each option's whole home page, side by side and top to bottom, so a founder compares what every section looks like,
 * not only the first screen. Boards made before composed pages have none, and then this shows nothing.
 */
export default function WholePages({ options }: { options: BoardOption[] }) {
  if (!options.some((option) => option.pictures.page)) return null;
  return (
    <section aria-label="The whole pages" className="grid gap-5 lg:grid-cols-3">
      {options.map((option) => (
        <figure key={option.letter} className="bg-surface shadow-card m-0 flex min-w-0 flex-col gap-3 rounded-2xl p-3">
          <figcaption className="flex items-center gap-3 px-2 pt-1">
            <Letter letter={option.letter} />
            <span className="truncate text-lg font-semibold">{option.name}</span>
          </figcaption>
          {option.composition && <p className="text-ink-soft px-2 text-sm text-pretty">{option.composition}</p>}
          {option.pictures.page ? (
            <BoardPicture src={option.pictures.page} alt={`The whole home page of option ${option.letter.toUpperCase()}, ${option.name}, on a desktop`} className="rounded-lg" />
          ) : (
            <BoardPicture src={option.pictures.desktop} alt={`The first screen of option ${option.letter.toUpperCase()}, ${option.name}, on a desktop`} className="rounded-lg" />
          )}
        </figure>
      ))}
    </section>
  );
}
