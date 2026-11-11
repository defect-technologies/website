import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import BoardChooser from "@/components/admin/designs/BoardChooser";
import { BoardPicture, Letter, OptionFacts, Reach } from "@/components/admin/designs/parts";
import { Card, Notice, PageHeader, When } from "@/components/admin/ui";
import type { BoardOption } from "@/lib/boards";
import { founderName } from "@/lib/founders";
import { requireFounder } from "@/server/auth/session";
import { boardById, type BoardWithLead } from "@/server/boards/store";
import { businessById } from "@/server/leads/businesses";

export const metadata: Metadata = { title: "Choose a design" };

function Decided({ board }: { board: BoardWithLead }) {
  const chosen = board.options.find((option) => option.letter === board.chosenLetter);
  return (
    <div className="flex flex-col gap-6">
      <Notice tone="good">
        {founderName(board.chosenBy ?? "") ?? "A founder"} chose {chosen ? `${chosen.letter.toUpperCase()}, ${chosen.name}` : "a design"} <When date={board.chosenAt} />. The site is built from it.
      </Notice>
      {board.feedback && (
        <Card className="flex flex-col gap-2 p-5">
          <h2 className="text-lg font-semibold">What they asked to change</h2>
          <p className="max-w-prose text-pretty whitespace-pre-line">{board.feedback}</p>
        </Card>
      )}
      <ul className="grid gap-5 lg:grid-cols-3">
        {board.options.map((option: BoardOption) => (
          <li key={option.letter} className={`bg-surface shadow-card flex flex-col gap-4 rounded-2xl p-3 ${option.letter === board.chosenLetter ? "ring-good ring-2" : "opacity-70"}`}>
            <a href={option.pictures.board} target="_blank" rel="noreferrer" className="focus-visible:outline-ink rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2">
              <BoardPicture src={option.pictures.desktop} alt={`The first screen of option ${option.letter.toUpperCase()}, ${option.name}. Opens its whole board.`} className="aspect-[16/10] rounded-lg object-cover object-top" />
            </a>
            <div className="flex flex-col gap-3 px-2 pb-2">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                  <Letter letter={option.letter} chosen={option.letter === board.chosenLetter} />
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

/** Three designs for one lead, before its site is built: compare them, choose one and say what should change. */
export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFounder();
  const board = await boardById((await params).id);
  if (!board) notFound();
  const lead = await businessById(board.businessId);
  return (
    <>
      <PageHeader title={board.businessName}>
        {lead?.website && (
          <ButtonLink href={lead.website} target="_blank" rel="noreferrer" variant="soft" icon={<ArrowSquareOut size={18} aria-hidden="true" />}>
            Their site today
          </ButtonLink>
        )}
      </PageHeader>
      {board.chosenAt ? <Decided board={board} /> : <BoardChooser boardId={board.id} options={board.options} />}
    </>
  );
}
