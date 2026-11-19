import { Card, Notice, When } from "@/components/admin/ui";
import { type BoardOption, CLEARED, isRedrawn, revisedLetter, verdictOf } from "@/lib/boards";
import type { BoardWithLead, revisionOf } from "@/server/boards/store";
import { BoardPicture, Letter, OptionFacts, Reach } from "./parts";

/** What was decided about the board, in a sentence: an option chosen, or all three turned down. */
function Decision({ board, by }: { board: BoardWithLead; by: string }) {
  if (board.chosenLetter === CLEARED) {
    return (
      <Notice tone="good">
        {by} cleared these designs <When date={board.chosenAt} />. If this business is built later, it gets new ones.
      </Notice>
    );
  }
  if (isRedrawn(board.chosenLetter)) {
    return (
      <Notice tone="good">
        {by} asked for three new designs <When date={board.chosenAt} />. They come back when they are drawn.
      </Notice>
    );
  }
  const revised = board.options.find((option) => option.letter === revisedLetter(board.chosenLetter));
  if (revised) {
    return (
      <Notice tone="good">
        {by} asked for {revised.letter.toUpperCase()}, {revised.name}, to be revised <When date={board.chosenAt} />. Its three revisions come back when they are drawn.
      </Notice>
    );
  }
  const chosen = board.options.find((option) => option.letter === board.chosenLetter);
  return (
    <Notice tone="good">
      {by} chose {chosen ? `${chosen.letter.toUpperCase()}, ${chosen.name}` : "a design"} <When date={board.chosenAt} />. The site is built from it.
    </Notice>
  );
}

/** A decided board: what was decided and by whom (`by`, a founder's or designer's name), their words, and the three options. */
export function Decided({ board, by }: { board: BoardWithLead; by: string }) {
  // The option a founder chose or asked to have revised. Three turned down are all dimmed.
  const decided = verdictOf(board.chosenLetter);
  const marked = decided?.verdict === "redraw" ? null : decided?.letter;
  return (
    <div className="flex flex-col gap-6">
      <Decision board={board} by={by} />
      {board.feedback && (
        <Card className="flex flex-col gap-2 p-5">
          <h2 className="text-lg font-semibold">What they asked to change</h2>
          <p className="max-w-prose text-pretty whitespace-pre-line">{board.feedback}</p>
        </Card>
      )}
      <ul className="grid gap-5 lg:grid-cols-3">
        {board.options.map((option: BoardOption) => (
          <li key={option.letter} className={`bg-surface shadow-card flex flex-col gap-4 rounded-2xl p-3 ${option.letter === marked ? "ring-good ring-2" : "opacity-70"}`}>
            <a href={option.pictures.board} target="_blank" rel="noreferrer" className="focus-visible:outline-ink rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2">
              <BoardPicture src={option.pictures.desktop} alt={`The first screen of option ${option.letter.toUpperCase()}, ${option.name}. Opens its whole board.`} className="aspect-[16/10] rounded-lg object-cover object-top" />
            </a>
            <div className="flex flex-col gap-3 px-2 pb-2">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                  <Letter letter={option.letter} chosen={option.letter === marked} />
                  <span className="truncate text-xl font-semibold">{option.name}</span>
                </span>
                <Reach boldness={option.boldness} />
              </div>
              <OptionFacts option={option} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** For three revisions of an earlier option: which option they revise, and what the founder asked for. */
export function RevisionNote({ revision }: { revision: Awaited<ReturnType<typeof revisionOf>> }) {
  if (!revision) return null;
  return (
    <Card className="flex flex-col gap-1 p-5">
      <h2 className="text-lg font-semibold">
        Revisions of {revision.option.letter.toUpperCase()}, {revision.option.name}
      </h2>
      <p className="text-ink-soft max-w-prose text-pretty whitespace-pre-line">{revision.feedback}</p>
    </Card>
  );
}

