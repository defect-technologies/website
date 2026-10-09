/**
 * Paints letterforms directly with palette knife strokes, in the ink colour
 * only. Running an image of the letters through the knife engine samples the
 * surrounding colours into the letters and the letters' colour into the
 * surroundings; painting the glyphs by hand keeps each one clean.
 */
import { oklchToSrgb, srgbToOklch, type Rgb } from "../src/paint/engine/color";
import { distanceToMask, edgeTangentField } from "../src/paint/engine/filters";
import { createPaintCanvas, type PaintCanvas } from "../src/paint/engine/knife/canvas";
import { applyRelief } from "../src/paint/engine/knife/relief";
import { rasterizeStroke, type KnifeStroke, type StrokeClip } from "../src/paint/engine/knife/stroke";
import { createRandom, fractalNoise2, type Random } from "../src/paint/engine/random";
import { createField, type Field, type RgbImage } from "../src/paint/engine/raster";

export type PaintedLetters = { color: RgbImage; alpha: Field };

type Glyphs = {
  coverage: Field;
  inside: Field;
  angle: Field;
  stem: number;
};

type Pass = {
  spacing: number;
  width: [number, number];
  length: [number, number];
  /** Only place strokes this deep inside the glyph, as a fraction of the stem. */
  depth: [number, number];
};

const BODY: Pass = { spacing: 0.32, width: [0.55, 0.85], length: [1.3, 2.3], depth: [0.18, Infinity] };
const EDGES: Pass = { spacing: 0.22, width: [0.3, 0.45], length: [1.6, 2.8], depth: [0, 0.3] };
const RAGGED_EDGE_PX = 1.6;

function inverted(field: Field): Field {
  const result = createField(field.width, field.height);
  for (let i = 0; i < field.data.length; i++) result.data[i] = 1 - field.data[i];
  return result;
}

function percentileInside(inside: Field, coverage: Field, fraction: number): number {
  const depths: number[] = [];
  for (let i = 0; i < inside.data.length; i++) if (coverage.data[i] >= 0.5) depths.push(inside.data[i]);
  depths.sort((a, b) => a - b);
  return depths[Math.floor(depths.length * fraction)] ?? 1;
}

function readGlyphs(coverage: Field): Glyphs {
  const inside = distanceToMask(inverted(coverage));
  const stem = Math.max(4, 2 * percentileInside(inside, coverage, 0.9));
  const { angle } = edgeTangentField(coverage, stem * 0.6);
  return { coverage, inside, angle, stem };
}

/** Signed distance to the glyph outline, nudged by noise so the painted edge is a little ragged. */
function raggedEdge(glyphs: Glyphs, seed: number): StrokeClip {
  const outside = distanceToMask(glyphs.coverage);
  const { width, height } = glyphs.coverage;
  const signed = createField(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const wobble = (fractalNoise2(x / 6, y / 6, seed, 3) - 0.5) * 2 * RAGGED_EDGE_PX;
      signed.data[i] = outside.data[i] - glyphs.inside.data[i] + wobble;
    }
  }
  return { threshold: 0, edge: { signedDistance: signed, overhang: 0.8 } };
}

function inkShade(ink: Rgb, random: Random, lift: number): Rgb {
  const [lightness, chroma, hue] = srgbToOklch(ink);
  return oklchToSrgb([lightness + lift + random.gaussian() * 0.025, chroma * (1 + random.gaussian() * 0.08), hue]);
}

function strokeAt(x: number, y: number, glyphs: Glyphs, pass: Pass, ink: Rgb, random: Random): KnifeStroke {
  const i = Math.round(y) * glyphs.coverage.width + Math.round(x);
  const width = glyphs.stem * random.range(...pass.width);
  return {
    x,
    y,
    angle: glyphs.angle.data[i] + random.gaussian() * 0.1,
    length: width * random.range(...pass.length),
    width,
    color: inkShade(ink, random, 0),
    edgeColor: inkShade(ink, random, 0.07),
    edgeMix: 0.45,
    load: random.range(0.95, 1.2),
    thickness: random.range(0.6, 1),
    seed: random.int(1_000_000),
  };
}

function strokesFor(glyphs: Glyphs, pass: Pass, ink: Rgb, random: Random): KnifeStroke[] {
  const { width, height } = glyphs.coverage;
  const step = Math.max(2, glyphs.stem * pass.spacing);
  const strokes: KnifeStroke[] = [];
  for (let gy = step / 2; gy < height; gy += step) {
    for (let gx = step / 2; gx < width; gx += step) {
      const x = Math.min(width - 1, Math.max(0, gx + random.range(-0.5, 0.5) * step));
      const y = Math.min(height - 1, Math.max(0, gy + random.range(-0.5, 0.5) * step));
      const depth = glyphs.inside.data[Math.round(y) * width + Math.round(x)] / glyphs.stem;
      if (depth <= 0 || depth < pass.depth[0] || depth > pass.depth[1]) continue;
      strokes.push(strokeAt(x, y, glyphs, pass, ink, random));
    }
  }
  return shuffled(strokes, random);
}

function shuffled<T>(items: T[], random: Random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = random.int(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function paintPass(canvas: PaintCanvas, strokes: KnifeStroke[], clip: StrokeClip) {
  for (const stroke of strokes) rasterizeStroke(canvas, stroke, clip);
}

export function paintLetters(coverage: Field, ink: Rgb, seed: number): PaintedLetters {
  const glyphs = readGlyphs(coverage);
  const random = createRandom(seed);
  const canvas = createPaintCanvas(coverage.width, coverage.height, ink, seed);
  const clip = raggedEdge(glyphs, seed);
  paintPass(canvas, strokesFor(glyphs, BODY, ink, random), clip);
  paintPass(canvas, strokesFor(glyphs, EDGES, ink, random), clip);
  applyRelief(canvas, 0.8, Math.max(coverage.width, coverage.height));
  return { color: canvas.color, alpha: canvas.paint };
}
