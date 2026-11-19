import { requireFounder } from "@/server/auth/session";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/admin/EmptyState";
import QueuedStudio from "@/components/admin/review/QueuedStudio";
import type { StudioActions, StudioPaths } from "@/components/admin/review/StudioContext";
import { TURN_PATH } from "@/lib/turn";
import { pointingUpdatesUnderway, queuePointingUpdates } from "@/server/review/pointingUpdates";
import { reviewQueue } from "@/server/review/queue";
import { runnerSettings } from "@/server/runner/settings";
import { addPointingAction, answerProposalAction, approveReviewAction, reviewAsksAction, sendReviewAction, splitSpokenNotesAction } from "./studioActions";

export const metadata: Metadata = { title: "Review" };

const FOUNDER_STUDIO: StudioActions = { send: sendReviewAction, approve: approveReviewAction, addPointing: addPointingAction, splitSpoken: splitSpokenNotesAction, asks: reviewAsksAction, answerProposal: answerProposalAction };

const FOUNDER_PATHS: StudioPaths = { close: "/admin", closeLabel: "Close review and go back to Today", review: "/admin/review", done: TURN_PATH };

/** One preview at a time: point at what's wrong, say it, and send it all back to the builder in one go. */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  await requireFounder();
  const { id } = await searchParams;
  const firstLook = await reviewQueue();
  const queue = (await queuePointingUpdates(firstLook)) ? await reviewQueue() : firstLook;
  if (!queue.length) {
    const [updating, { designBoards }] = await Promise.all([pointingUpdatesUnderway(), runnerSettings()]);
    if (updating) {
      const previews = `${updating} ${updating === 1 ? "preview" : "previews"}`;
      return (
        <EmptyState title={designBoards ? `New designs for ${previews}` : `Updating ${previews}`} action={<ButtonLink href={designBoards ? "/admin/designs" : "/admin/builds"} variant="soft" icon={<CheckCircle size={18} aria-hidden="true" />}>{designBoards ? "Open Designs" : "See what\u2019s building"}</ButtonLink>}>
          {designBoards ? "Each gets three new designs, which land on Designs as they are drawn." : "Each comes back here as it finishes, and its questions take you to the part they ask about."}
        </EmptyState>
      );
    }
    return (
      <EmptyState title="Every preview has been reviewed" action={<ButtonLink href="/admin/builds" variant="soft" icon={<CheckCircle size={18} aria-hidden="true" />}>See what&rsquo;s building</ButtonLink>}>
        New previews land here as the runner finishes them.
      </EmptyState>
    );
  }
  return <QueuedStudio queue={queue} id={id} actions={FOUNDER_STUDIO} paths={FOUNDER_PATHS} />;
}
