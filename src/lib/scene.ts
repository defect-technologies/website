export type Speaker = "studio" | "you";

export type RGB = [number, number, number];

export type Lamp = {
  text: string;
  speaker: Speaker;
  rgb: RGB;
  power: number;
  scale: number;
};

export const CONVERSATION: Lamp[] = [
  { text: "what do you want?", speaker: "studio", rgb: [255, 241, 220], power: 0.95, scale: 1 },
  { text: "something beautiful?", speaker: "you", rgb: [255, 79, 160], power: 1.0, scale: 0.96 },
  { text: "oh.", speaker: "studio", rgb: [255, 241, 220], power: 0.9, scale: 1.25 },
  { text: "oh?", speaker: "you", rgb: [255, 79, 160], power: 0.95, scale: 1.25 },
  { text: "I make that in my sleep.", speaker: "studio", rgb: [255, 172, 46], power: 1.25, scale: 1 },
];

export const CLOSING_LINE = {
  text: "we make good technology for good people",
  rgb: [255, 241, 220] as RGB,
  power: 1.1,
};

export const CLOSING_MARK = {
  text: "defect.tech",
  rgb: [255, 172, 46] as RGB,
  power: 0.8,
};

export type Slab = {
  x: number;
  w: number;
  y: number;
  h: number;
  z: number;
};

/** Every wall sits at one depth, so the room reads as a single surface. */
export const WALL_Z = 0.2;

/**
 * x and w are fractions of viewport width, y and h of viewport height with y
 * measured up from the bottom. Everything here is deliberately kept clear of
 * the centre column the conversation occupies, so no wall crosses the text.
 */
export const ROOM: Slab[] = [
  { x: -0.05, w: 0.115, y: -0.08, h: 1.16, z: WALL_Z },
  { x: 0.08, w: 0.032, y: -0.08, h: 1.16, z: WALL_Z },
  { x: 0.888, w: 0.16, y: -0.08, h: 1.16, z: WALL_Z },
  { x: 0.852, w: 0.028, y: -0.08, h: 1.16, z: WALL_Z },
  { x: -0.06, w: 1.12, y: 0.935, h: 0.17, z: WALL_Z },
  { x: -0.06, w: 1.12, y: -0.09, h: 0.125, z: WALL_Z },
];

export const LIGHT_Z = 0.44;
export const LIGHT_RADIUS = 0.3;
/**
 * Low, because every line stays lit: by the closing line five lamps are
 * summing into the same wall, and the room has to still read as a dark room.
 */
export const EXPOSURE = 1.4;

/** How tall the pinned stage's scroll container is. */
export const SCROLL_LENGTH = "300vh";

export const SPEAKER_LABEL: Record<Speaker, string> = {
  studio: "defect.tech",
  you: "You",
};

export function cssColor([r, g, b]: RGB): string {
  return `rgb(${r} ${g} ${b})`;
}
