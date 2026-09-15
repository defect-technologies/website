/** A tube catching, and a tube giving up. Played on a clock, never scrubbed. */
const ON_SEQUENCE = [0, 1, 0, 0, 1, 0.35, 1];
const OFF_SEQUENCE = [1, 0, 1, 0, 0, 0.2, 0];

/** How long a strike takes, in milliseconds of real time. */
export const FLICKER_MS = 280;

export const BLACKOUT_AT = 0.2;
export const REVEAL_AT = 0.29;
export const REVEAL_STEP = 0.085;
export const CLOSING_AT = 0.8;

export function lineThreshold(index: number): number {
  return REVEAL_AT + index * REVEAL_STEP;
}

/**
 * Scroll decides whether a light is on. The clock decides what the switching
 * looks like, so scrolling slowly cannot play the flicker in slow motion.
 */
export function flicker(target: 0 | 1, elapsed: number): number {
  if (elapsed >= FLICKER_MS) return target;
  const sequence = target === 1 ? ON_SEQUENCE : OFF_SEQUENCE;
  const step = Math.floor((elapsed / FLICKER_MS) * sequence.length);
  return sequence[Math.min(sequence.length - 1, step)];
}

export function scrollProgress(): number {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  return Math.min(1, Math.max(0, window.scrollY / scrollable));
}

export function glow(rgb: readonly [number, number, number], power: number): string {
  const [r, g, b] = rgb;
  const near = `0 0 ${(0.14 * power).toFixed(3)}em rgb(${r} ${g} ${b} / ${(0.5 * power).toFixed(3)})`;
  const far = `0 0 ${(0.62 * power).toFixed(3)}em rgb(${r} ${g} ${b} / ${(0.32 * power).toFixed(3)})`;
  return `${near}, ${far}`;
}
