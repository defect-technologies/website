import { Card, When } from "@/components/admin/ui";
import type { BuiltDesign } from "@/server/boards/builtDesign";
import { BoardPicture, Letter, OptionFacts } from "./parts";

/**
 * The chosen design a business's preview was built from: its first screen, which opens the whole board, with who chose
 * it, when, and what they asked to change. Shows nothing for a preview built before boards recorded their build.
 */
export default function BuiltFrom({ design }: { design: BuiltDesign | null }) {
  if (!design) return null;
  const { option } = design;
  return (
    <Card className="flex flex-col gap-3 p-3">
      <a href={option.pictures.board} target="_blank" rel="noreferrer" className="focus-visible:outline-ink rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2">
        <BoardPicture src={option.pictures.desktop} alt={`The first screen of design ${design.letter.toUpperCase()}, ${option.name}, which the preview was built from. Opens its whole board.`} className="aspect-[16/10] rounded-lg object-cover object-top" />
      </a>
      <div className="flex flex-col gap-2 px-2 pb-2">
        <h2 className="flex min-w-0 items-center gap-3">
          <Letter letter={design.letter} />
          <span className="truncate text-lg font-semibold">{option.name}</span>
        </h2>
        <p className="text-ink-soft text-sm">
          Built from the design {design.by} chose <When date={design.at} />
        </p>
        <OptionFacts option={option} />
        {design.feedback && <p className="text-ink-soft border-ink/10 border-l-2 pl-3 text-sm text-pretty whitespace-pre-line">{design.feedback}</p>}
      </div>
    </Card>
  );
}
