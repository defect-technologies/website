export type Speaker = "studio" | "you";

export type Lamp = {
  text: string;
  speaker: Speaker;
  rgb: [number, number, number];
  power: number;
  scale: number;
  /** Where the line sits on the stage, as a fraction of viewport height. */
  top: number;
};

export const CONVERSATION: Lamp[] = [
  { text: "what do you want?", speaker: "studio", rgb: [255, 241, 220], power: 0.95, scale: 1, top: 0.08 },
  { text: "something beautiful?", speaker: "you", rgb: [63, 233, 207], power: 1.05, scale: 0.96, top: 0.26 },
  { text: "oh.", speaker: "studio", rgb: [255, 172, 46], power: 0.9, scale: 1.3, top: 0.44 },
  { text: "oh?", speaker: "you", rgb: [255, 79, 160], power: 0.95, scale: 1.3, top: 0.585 },
  { text: "I make that in my sleep.", speaker: "studio", rgb: [255, 58, 18], power: 1.35, scale: 1.02, top: 0.755 },
];

/** How much scroll the pinned stage consumes before the page ends. */
export const SCROLL_LENGTH = "520vh";

export type Slab = {
  x: number;
  w: number;
  y: number;
  h: number;
  z: number;
};

/**
 * The room. x and w are fractions of viewport width; y, h and z are fractions
 * of viewport height, with y measured up from the bottom edge. The back wall
 * sits at z = 0 and the dialogue burns at LIGHT_Z, so every slab below casts.
 */
export const ROOM: Slab[] = [
  { x: -0.04, w: 0.11, y: -0.08, h: 1.16, z: 0.15 },
  { x: 0.238, w: 0.026, y: -0.08, h: 1.16, z: 0.095 },
  { x: 0.6, w: 0.042, y: -0.08, h: 1.16, z: 0.125 },
  { x: 0.9, w: 0.16, y: -0.08, h: 1.16, z: 0.205 },
  { x: 0.44, w: 0.62, y: 0.83, h: 0.26, z: 0.235 },
  { x: -0.06, w: 1.12, y: -0.1, h: 0.13, z: 0.275 },
];

export const LIGHT_Z = 0.44;
export const LIGHT_RADIUS = 0.3;
/**
 * Low, because every line stays lit: by the closing line five lamps are
 * summing into the same wall, and the room has to still read as a dark room.
 */
export const EXPOSURE = 1.4;

export const SPEAKER_LABEL: Record<Speaker, string> = {
  studio: "defect.tech",
  you: "You",
};

export function cssColor([r, g, b]: [number, number, number]): string {
  return `rgb(${r} ${g} ${b})`;
}
