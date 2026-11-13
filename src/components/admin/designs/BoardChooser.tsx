import { ArrowsClockwise, CaretRight, Hammer } from "@phosphor-icons/react/dist/ssr";
import { chooseBoardAction, redrawBoardsAction } from "@/app/admin/(panel)/designs/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card } from "@/components/admin/ui";
import type { BoardOption } from "@/lib/boards";
import FeedbackField from "./FeedbackField";
import { BoardPicture, FirstScreens, Letter, OptionFacts, Reach } from "./parts";

function Choice({ option }: { option: BoardOption }) {
  return (
    <label className="group bg-surface shadow-card has-[:checked]:ring-ink has-[:focus-visible]:outline-ink flex cursor-pointer flex-col gap-4 rounded-2xl p-3 transition-shadow duration-150 has-[:checked]:ring-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2">
      <input type="radio" name="letter" value={option.letter} required className="sr-only" aria-label={`Option ${option.letter.toUpperCase()}: ${option.name}`} />
      <FirstScreens option={option} />
      <span className="flex flex-col gap-3 px-2 pb-2">
        <span className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-3">
            <Letter letter={option.letter} selectable />
            <span className="truncate text-xl font-semibold">{option.name}</span>
          </span>
          <Reach boldness={option.boldness} />
        </span>
        <span className="text-ink-soft text-pretty">{option.idea}</span>
        <OptionFacts option={option} />
      </span>
    </label>
  );
}

/** One option's whole board, opened one at a time: the first screens above are for comparing, this is for reading. */
function FullBoard({ option, open }: { option: BoardOption; open: boolean }) {
  return (
    <details name="full-board" open={open} className="group/board bg-surface shadow-card rounded-2xl">
      <summary className="hover:bg-paper-shade/50 flex cursor-pointer list-none items-center gap-3 rounded-2xl px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
        <CaretRight size={16} weight="bold" className="ease-knife transition-transform duration-150 group-open/board:rotate-90" aria-hidden="true" />
        The whole board of {option.letter.toUpperCase()}, {option.name}
      </summary>
      <div className="px-3 pb-3">
        <BoardPicture src={option.pictures.board} alt={`The board of option ${option.letter.toUpperCase()}: its first screen, colours, type, buttons, photos, logo and motif`} className="rounded-lg" />
      </div>
    </details>
  );
}

/**
 * The three options side by side, each a radio in one group, then every whole board, then what the founder wants
 * changed, typed or said. One form: choosing builds the site, and its second button asks for three new designs.
 */
export default function BoardChooser({ boardId, options }: { boardId: string; options: BoardOption[] }) {
  return (
    <form action={chooseBoardAction} className="flex flex-col gap-8">
      <input type="hidden" name="id" value={boardId} />
      <fieldset className="grid gap-5 lg:grid-cols-3">
        <legend className="sr-only">Choose one design</legend>
        {options.map((option) => (
          <Choice key={option.letter} option={option} />
        ))}
      </fieldset>
      <div className="flex flex-col gap-3">
        {options.map((option, index) => (
          <FullBoard key={option.letter} option={option} open={index === 0} />
        ))}
      </div>
      <Card className="flex flex-col gap-4 p-5 lg:sticky lg:bottom-4 lg:flex-row lg:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <FeedbackField />
          <label className="text-ink-soft flex min-h-9 w-fit cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" name="remember" className="accent-ink size-4 shrink-0" />
            Remember this for every site
          </label>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <SubmitButton variant="solid" icon={<Hammer size={18} aria-hidden="true" />}>
            Build the chosen design
          </SubmitButton>
          <SubmitButton variant="soft" formAction={redrawBoardsAction} formNoValidate icon={<ArrowsClockwise size={18} aria-hidden="true" />}>
            Draw three new designs
          </SubmitButton>
        </div>
      </Card>
    </form>
  );
}
