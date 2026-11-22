import { HandPointing } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/admin/EmptyState";
import QueuedStudio from "@/components/admin/review/QueuedStudio";
import type { StudioActions, StudioPaths } from "@/components/admin/review/StudioContext";
import { DESIGNER_HOME, requireDesigner } from "@/server/auth/designerSession";
import { designerReviewQueue } from "@/server/designers/work";
import { addDesignerPointingAction, answerDesignerProposalAction, approveDesignerReviewAction, designerAsksAction, sendDesignerReviewAction, splitDesignerNotesAction } from "./actions";

export const metadata: Metadata = { title: "Review" };

const DESIGNER_STUDIO: StudioActions = {
  send: sendDesignerReviewAction,
  approve: approveDesignerReviewAction,
  addPointing: addDesignerPointingAction,
  splitSpoken: splitDesignerNotesAction,
  asks: designerAsksAction,
  answerProposal: answerDesignerProposalAction,
};

const DESIGNER_PATHS: StudioPaths = { close: DESIGNER_HOME, closeLabel: "Back to To do", review: "/designer/review", done: DESIGNER_HOME };

/** The built sites of the designer's own businesses, one at a time: approve one, or point at what's wrong and say it. */
export default async function DesignerReviewPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const designer = await requireDesigner();
  const queue = await designerReviewQueue(designer.id);
  if (!queue.length) {
    return (
      <EmptyState title="Every site of yours has been reviewed" action={<ButtonLink href={DESIGNER_HOME} variant="soft" icon={<HandPointing size={18} aria-hidden="true" />}>Back to To do</ButtonLink>}>
        A site lands here when the design you chose is built, and again when your notes are made.
      </EmptyState>
    );
  }
  return <QueuedStudio queue={queue} id={(await searchParams).id} actions={DESIGNER_STUDIO} paths={DESIGNER_PATHS} />;
}
