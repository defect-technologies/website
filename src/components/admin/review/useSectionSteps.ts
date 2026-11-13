"use client";

import { useEffect, useState } from "react";
import type { PageSections } from "@/hooks/useReviewBridge";
import { samePage } from "@/lib/reviewAsks";
import { type ReviewSection, sectionInView } from "@/lib/reviewSections";

type Bridge = {
  path: string;
  reportsSections: boolean;
  pageSections: PageSections;
  requestSections: () => void;
  show: (target: { path: string; selector: string; question: string; block?: "start" | "center" }) => void;
};

const nameOf = (section: ReviewSection) => section.heading || `Section ${section.index}`;

/**
 * Stepping through a page's sections while pointing. The preview is asked for its sections when pointing starts and
 * whenever it goes to another page. The steps begin at the section the founder is looking at, and each step shows
 * that section from its top with the admin's outline.
 */
export function useSectionSteps(bridge: Bridge, pointing: boolean) {
  const { path, reportsSections, pageSections, requestSections, show } = bridge;
  const [stepped, setStepped] = useState<{ path: string; at: number } | null>(null);
  const available = pointing && reportsSections;

  useEffect(() => {
    if (available) requestSections();
  }, [available, path, requestSections]);

  const sections = available && samePage(pageSections.path, path) ? pageSections.sections : [];
  const at = Math.min(stepped && samePage(stepped.path, path) ? stepped.at : sectionInView(sections, pageSections.scrollY), Math.max(0, sections.length - 1));
  const current = sections[at] ?? null;

  const go = (next: number) => {
    const section = sections[next];
    if (!section) return;
    setStepped({ path, at: next });
    // No words on the page: the card already names the section, and a label there would sit under the admin's bar.
    show({ path, selector: section.selector, question: "", block: "start" });
  };

  return { sections, at, current, previous: () => go(at - 1), next: () => go(at + 1), name: current ? nameOf(current) : "" };
}

export type SectionSteps = ReturnType<typeof useSectionSteps>;
