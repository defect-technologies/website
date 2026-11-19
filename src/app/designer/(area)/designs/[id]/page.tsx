import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { BoardActions } from "@/components/admin/designs/boardActions";
import DesignScreen from "@/components/admin/designs/DesignScreen";
import { DESIGNER_HOME, requireDesigner } from "@/server/auth/designerSession";
import { boardById } from "@/server/boards/store";
import { owns } from "@/server/designers/claims";
import { chooseAsDesignerAction, reviseAsDesignerAction, redrawAsDesignerAction } from "../../actions";

export const metadata: Metadata = { title: "Choose a design" };

const DESIGNER_BOARD_ACTIONS: BoardActions = { choose: chooseAsDesignerAction, revise: reviseAsDesignerAction, redraw: redrawAsDesignerAction };

/** The three designs of a business the designer took. Another designer's business is not found. */
export default async function DesignerDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const designer = await requireDesigner();
  const board = await boardById((await params).id);
  if (!board || !(await owns(designer.id, board.businessId))) notFound();
  return <DesignScreen board={board} actions={DESIGNER_BOARD_ACTIONS} close={{ href: DESIGNER_HOME, label: "Close and go back to Your turn" }} />;
}
