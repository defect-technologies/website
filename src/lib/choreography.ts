const FLICKER = [0, 1, 0, 0.7, 0, 0, 0.3, 0];
const BLACKOUT_START = 0.05;
const BLACKOUT_END = 0.086;

const EMBER = 0.18;

/** Opacity of the white sheet that covers the room until the lights cut out. */
export function paperOpacity(progress: number): number {
  if (progress <= BLACKOUT_START) return 1;
  if (progress >= BLACKOUT_END) return 0;
  const span = (progress - BLACKOUT_START) / (BLACKOUT_END - BLACKOUT_START);
  return FLICKER[Math.min(FLICKER.length - 1, Math.floor(span * FLICKER.length))];
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * How brightly one line burns, from where its own centre sits in the viewport.
 * A line rises to full as it reaches the middle of the screen, then settles to
 * an ember once the next one takes over.
 */
export function lampPower(centreRatio: number): number {
  const arrival = smoothstep(1.12, 0.68, centreRatio);
  const handover = smoothstep(0.44, 0.1, centreRatio);
  return arrival * (1 - (1 - EMBER) * handover);
}

export function scrollProgress(): number {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  return Math.min(1, Math.max(0, window.scrollY / scrollable));
}

export function glow(rgb: [number, number, number], power: number): string {
  const [r, g, b] = rgb;
  const near = `0 0 ${(0.14 * power).toFixed(3)}em rgb(${r} ${g} ${b} / ${(0.5 * power).toFixed(3)})`;
  const far = `0 0 ${(0.62 * power).toFixed(3)}em rgb(${r} ${g} ${b} / ${(0.32 * power).toFixed(3)})`;
  return `${near}, ${far}`;
}
