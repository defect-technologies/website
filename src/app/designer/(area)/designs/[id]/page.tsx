import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BusinessBrief from "@/components/admin/designers/BusinessBrief";
import DesignerChooser, { type DesignerBoardActions } from "@/components/admin/designers/DesignerChooser";
import { Decided } from "@/components/admin/designs/DecidedBoard";
import { DESIGNER_HOME, requireDesigner } from "@/server/auth/designerSession";
import { type BoardWithLead, boardById, notesBehind } from "@/server/boards/store";
import { ownerOf } from "@/server/designers/claims";
import { deciders } from "@/server/designers/people";
import { placesOf } from "@/server/designers/work";
import { businessById } from "@/server/leads/businesses";
import { chooseAsDesignerAction, redrawAsDesignerAction } from "../../actions";

export const metadata: Metadata = { title: "Choose a design" };

const DESIGNER_BOARD_ACTIONS: DesignerBoardActions = { choose: chooseAsDesignerAction, redraw: redrawAsDesignerAction };

/** What a designer may know of the business behind the designs: never its owner's contact details. */
async function briefOf(board: BoardWithLead) {
  const [lead, places, notes] = await Promise.all([businessById(board.businessId), placesOf([board.businessId]), notesBehind(board)]);
  return {
    businessName: board.businessName,
    place: places.get(board.businessId) ?? "",
    website: lead?.website ?? "",
    problemSummary: lead?.problemSummary ?? "",
    notesBehind: board.chosenAt ? "" : notes,
    back: { href: DESIGNER_HOME, label: "Back to To do" },
  };
}

/** Three designs to decide on: open to every designer until one decides, then only to that designer. */
export default async function DesignerDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const designer = await requireDesigner();
  const board = await boardById((await params).id);
  const owner = board ? await ownerOf(board.businessId) : null;
  if (!board || (owner && owner !== designer.id)) notFound();
  const brief = <BusinessBrief {...await briefOf(board)} />;
  if (board.chosenAt) {
    return (
      <>
        {brief}
        <Decided board={board} by={(await deciders())(board.chosenBy ?? "").name} />
      </>
    );
  }
  return (
    <>
      {brief}
      <DesignerChooser boardId={board.id} options={board.options} actions={DESIGNER_BOARD_ACTIONS} />
    </>
  );
}
