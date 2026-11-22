import { ArrowLeft, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { ButtonLink } from "@/components/Button";
import { PageHeader } from "@/components/admin/ui";
import { type BoardWithLead, revisionOf } from "@/server/boards/store";
import { deciders } from "@/server/designers/people";
import { businessById } from "@/server/leads/businesses";
import type { BoardActions } from "./boardActions";
import BoardChooser from "./BoardChooser";
import { Decided, RevisionNote } from "./DecidedBoard";
import PhoneChooser from "./PhoneChooser";

type Props = { board: BoardWithLead; actions: BoardActions; close: { href: string; label: string } };

/**
 * Three designs for one lead, before its site is built: compare them, choose one and say what should change. Once
 * decided, what was decided. A founder's Designs and a designer's own pass their own actions and close link.
 */
export default async function DesignScreen({ board, actions, close }: Props) {
  const lead = await businessById(board.businessId);
  const header = (
    <PageHeader title={board.businessName}>
      <ButtonLink href={close.href} variant="ghost">
        <ArrowLeft size={18} aria-hidden="true" />
        {close.label}
      </ButtonLink>
      {lead?.website && (
        <ButtonLink href={lead.website} target="_blank" rel="noreferrer" variant="soft" icon={<ArrowSquareOut size={18} aria-hidden="true" />}>
          Their site today
        </ButtonLink>
      )}
    </PageHeader>
  );
  if (board.chosenAt) {
    return (
      <>
        {header}
        <Decided board={board} by={(await deciders())(board.chosenBy ?? "").name} />
      </>
    );
  }
  const revision = await revisionOf(board);
  // A phone gets the chooser made for a thumb; a wide screen gets the three options side by side.
  return (
    <>
      <PhoneChooser
        boardId={board.id}
        businessName={board.businessName}
        website={lead?.website ?? ""}
        options={board.options}
        revision={revision ? { letter: revision.option.letter, name: revision.option.name, feedback: revision.feedback } : null}
        actions={actions}
        close={close}
      />
      <div className="flex flex-col gap-8 max-lg:hidden">
        {header}
        <RevisionNote revision={revision} />
        <BoardChooser boardId={board.id} options={board.options} actions={actions} />
      </div>
    </>
  );
}
