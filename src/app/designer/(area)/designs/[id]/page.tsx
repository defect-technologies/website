import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { BoardActions } from "@/components/admin/designs/boardActions";
import DesignScreen from "@/components/admin/designs/DesignScreen";
import { DESIGNER_HOME, requireDesigner } from "@/server/auth/designerSession";
import { boardById } from "@/server/boards/store";
import { ownerOf } from "@/server/designers/claims";
import { chooseAsDesignerAction, reviseAsDesignerAction, redrawAsDesignerAction } from "../../actions";

export const metadata: Metadata = { title: "Choose a design" };

const DESIGNER_BOARD_ACTIONS: BoardActions = { choose: chooseAsDesignerAction, revise: reviseAsDesignerAction, redraw: redrawAsDesignerAction };

/** Three designs to decide on: open to every designer until one decides, then only to that designer. */
export default async function DesignerDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const designer = await requireDesigner();
  const board = await boardById((await params).id);
  const owner = board ? await ownerOf(board.businessId) : null;
  if (!board || (owner && owner !== designer.id)) notFound();
  return <DesignScreen board={board} actions={DESIGNER_BOARD_ACTIONS} close={{ href: DESIGNER_HOME, label: "Back to designs" }} />;
}
