import type { BoardOption } from "@/lib/boards";
import { BoardPicture, FirstScreens, Letter, OptionFacts, Reach, reachLabel } from "../designs/parts";

/** The option's whole home page, or its board of colours, type and photos when it was drawn before whole pages. */
function WholePage({ option }: { option: BoardOption }) {
  const name = `option ${option.letter.toUpperCase()}, ${option.name}`;
  const wide = option.pictures.page ?? option.pictures.board;
  const narrow = option.pictures.pagePhone ?? option.pictures.narrow ?? wide;
  const what = option.pictures.page ? "whole home page" : "colours, type and photos";
  return (
    <details className="group/page">
      <summary className="text-ink-soft hover:text-ink hover:bg-paper-shade/50 flex min-h-11 cursor-pointer list-none items-center rounded-b-2xl px-5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span className="group-open/page:hidden">See its {what}</span>
        <span className="hidden group-open/page:inline">Hide its {what}</span>
      </summary>
      <div className="px-3 pb-3">
        <BoardPicture src={narrow} alt={`The ${what} of ${name}`} className="rounded-lg lg:hidden" />
        <BoardPicture src={wide} alt={`The ${what} of ${name}`} className="rounded-lg max-lg:hidden" />
      </div>
    </details>
  );
}

/** One of the three designs, picked by tapping it. Its whole page opens below it for a closer look. */
export default function DesignOption({ option, selected, onSelect }: { option: BoardOption; selected: boolean; onSelect: () => void }) {
  return (
    <div className={`bg-surface shadow-card flex flex-col rounded-2xl transition-shadow duration-150 ${selected ? "ring-ink ring-2" : ""}`}>
      <label className="group has-[:focus-visible]:outline-ink flex cursor-pointer flex-col gap-4 rounded-2xl p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2">
        <input type="radio" name="letter" value={option.letter} checked={selected} onChange={onSelect} className="sr-only" aria-label={`Option ${option.letter.toUpperCase()}, ${option.name}`} />
        <FirstScreens option={option} />
        <span className="flex flex-col gap-3 px-2">
          <span className="flex min-w-0 items-center gap-3">
            <Letter letter={option.letter} selectable />
            <span className="truncate text-xl font-semibold">{option.name}</span>
          </span>
          <span className="text-ink-soft text-pretty">{option.idea}</span>
          <span className="text-ink-soft flex items-center gap-2 text-sm">
            <Reach boldness={option.boldness} />
            {reachLabel(option.boldness)}
          </span>
          <OptionFacts option={option} />
        </span>
      </label>
      <WholePage option={option} />
    </div>
  );
}
