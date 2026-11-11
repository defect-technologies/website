"use client";

import { answerProposalAction } from "@/app/admin/(panel)/review/studioActions";
import type { ReviewNote } from "@/lib/review";
import type { ReviewAsk } from "@/lib/reviewAsks";
import { noteFromProposal } from "./reviewDraft";
import type { AskFlow } from "./useAskFlow";

/** Yes keeps the critic's proposal as one of the founder's notes; either answer is saved, and the flow moves on. */
export function useProposalAnswer(ask: ReviewAsk | null, flow: AskFlow, add: (note: ReviewNote) => void) {
  return (accepted: boolean) => {
    const proposal = ask?.proposal;
    if (!ask || !proposal) return;
    void answerProposalAction({ jobId: proposal.jobId, proposalId: proposal.id, accepted });
    const note = accepted ? noteFromProposal(ask) : null;
    if (note) add(note);
    if (accepted) flow.good();
    else flow.skip();
  };
}
