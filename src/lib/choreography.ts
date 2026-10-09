/** Scroll positions, as fractions of the pinned stage, where the knife moves. */
export const WORDMARK_SCRAPED_AT = 0.1;
export const FIRST_LINE_AT = 0.18;
export const LINE_STEP = 0.11;

/** How tall the pinned stage's scroll container is. */
export const SCROLL_LENGTH = "340vh";

export function lineThreshold(index: number): number {
  return FIRST_LINE_AT + index * LINE_STEP;
}

/** How far through its own scroll length the pinned stage is, from 0 to 1. */
export function stageProgress(container: HTMLElement): number {
  const box = container.getBoundingClientRect();
  const scrollable = box.height - window.innerHeight;
  if (scrollable <= 0) return 0;
  return Math.min(1, Math.max(0, -box.top / scrollable));
}
