import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { BoardActions } from "@/components/admin/designs/boardActions";
import DesignScreen from "@/components/admin/designs/DesignScreen";
import { requireFounder } from "@/server/auth/session";
import { boardById } from "@/server/boards/store";
import { chooseBoardAction, redrawBoardsAction, reviseBoardAction } from "../actions";

export const metadata: Metadata = { title: "Choose a design" };

const FOUNDER_BOARD_ACTIONS: BoardActions = { choose: chooseBoardAction, revise: reviseBoardAction, redraw: redrawBoardsAction };

/** Three designs for one lead, before its site is built: compare them, choose one and say what should change. */
export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFounder();
  const board = await boardById((await params).id);
  if (!board) notFound();
  return <DesignScreen board={board} actions={FOUNDER_BOARD_ACTIONS} close={{ href: "/admin/designs", label: "Back to designs" }} />;
}
