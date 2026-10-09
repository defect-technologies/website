import { hexToRgb, type Rgb } from "../src/paint/engine/color";
import { imageToRgba, type RgbImage } from "../src/paint/engine/raster";

export const PAPER = hexToRgb("#f4f1ea");

/** Paint lighter than the paper by less than this is the engine's own vignette, not paint. */
const VIGNETTE_LIFT = 0.036;
const LIGHT_PAINT_RAMP = 0.04;

function darkening(colour: Rgb): number {
  return Math.max(...colour.map((value, c) => (value < PAPER[c] ? (PAPER[c] - value) / PAPER[c] : 0)));
}

function lightening(colour: Rgb): number {
  const lift = Math.max(...colour.map((value, c) => value - PAPER[c]));
  return Math.min(1, Math.max(0, (lift - VIGNETTE_LIFT) / LIGHT_PAINT_RAMP));
}

/**
 * Turns a painting on the paper into paint on a transparent ground, so it can
 * sit on the page like paint rather than a picture. Colours lighter than the
 * paper count as bare canvas unless `keepLightPaint` is set, which keeps
 * highlights such as teeth and white shirts that rise clearly above it.
 */
export function keyOutPaper(painted: RgbImage, keepLightPaint = false): Uint8ClampedArray {
  const rgba = imageToRgba(painted);
  for (let p = 0; p < painted.width * painted.height; p++) {
    const colour = [0, 1, 2].map((c) => painted.data[p * 3 + c]) as Rgb;
    const alpha = Math.max(darkening(colour), keepLightPaint ? lightening(colour) : 0);
    const solid = alpha < 0.03 ? 0 : Math.min(1, alpha);
    for (let c = 0; c < 3; c++) {
      const unmixed = solid > 0 ? PAPER[c] + (colour[c] - PAPER[c]) / solid : PAPER[c];
      rgba[p * 4 + c] = Math.round(Math.min(1, Math.max(0, unmixed)) * 255);
    }
    rgba[p * 4 + 3] = Math.round(solid * 255);
  }
  return rgba;
}
