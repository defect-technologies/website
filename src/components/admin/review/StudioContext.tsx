"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ReviewAsk } from "@/lib/reviewAsks";
import type { SplitNote } from "@/server/review/noteWriter";
import type { ProposalAnswerInput, ReviewInput, ReviewResult } from "@/server/review/verdicts";

/** The server actions a review studio calls. A founder's check requireFounder; a designer's check the business is theirs. */
export type StudioActions = {
  send: (input: ReviewInput) => Promise<ReviewResult>;
  approve: (input: ReviewInput) => Promise<ReviewResult>;
  addPointing: (businessId: string) => Promise<ReviewResult>;
  splitSpoken: (transcript: string) => Promise<SplitNote[]>;
  asks: (businessId: string) => Promise<{ previewUrl: string; asks: ReviewAsk[] }>;
  answerProposal: (input: ProposalAnswerInput) => Promise<boolean>;
};

/** Where the studio's links go: `review` is the page a preview opens on with ?id=, `done` where a verdict lands. */
export type StudioPaths = { close: string; closeLabel: string; review: string; done: string };

type Studio = { actions: StudioActions; paths: StudioPaths };

const StudioContext = createContext<Studio | null>(null);

export function StudioProvider({ actions, paths, children }: Studio & { children: ReactNode }) {
  return <StudioContext.Provider value={{ actions, paths }}>{children}</StudioContext.Provider>;
}

export function useStudio(): Studio {
  const studio = useContext(StudioContext);
  if (!studio) throw new Error("A review studio needs its actions: render it inside StudioProvider.");
  return studio;
}

export const reviewHref = (paths: StudioPaths, id: string) => `${paths.review}?id=${id}`;
