import type { Rgb } from "./engine/color";
import { wetColor } from "./engine/knife/drips";
import { valueNoise1 } from "./engine/random";
import { clamp01 } from "./engine/raster";
import type { Animation, Point } from "./knifePass";
import { TILE, KnifeTiles, type Tile } from "./knifeTiles";

/** One run of paint, in canvas pixels and milliseconds. */
export interface DripSpec {
  from: Point;
  length: number;
  width: number;
  delay: number;
  duration: number;
  seed: number;
}

interface Drip extends DripSpec {
  colour: Rgb;
  /** How many rows below `from` are laid for good. */
  laid: number;
  x: number;
  finished: boolean;
}

/** Below this much paint at its source, there is nothing to drip. */
const LOADED = 0.85;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function paintAt(tiles: KnifeTiles, point: Point): { colour: Rgb; coverage: number } | null {
  const x = Math.round(point.x);
  const y = Math.round(point.y);
  const tile = tiles.writable(x, y);
  if (!tile) return null;
  const index = (y - tile.top) * TILE + (x - tile.left);
  const coverage = tile.coverage[index];
  if (coverage <= 0) return { colour: [0, 0, 0], coverage };
  const colour: Rgb = [0, 1, 2].map((c) => tile.colour[index * 3 + c] / coverage) as Rgb;
  return { colour, coverage };
}

function blend(tile: Tile, index: number, colour: Rgb, alpha: number, height: number): void {
  for (let c = 0; c < 3; c++) tile.colour[index * 3 + c] = tile.colour[index * 3 + c] * (1 - alpha) + colour[c] * alpha;
  tile.coverage[index] = tile.coverage[index] * (1 - alpha) + alpha;
  tile.thickness[index] = Math.max(tile.thickness[index], tile.thickness[index] * (1 - alpha) + height);
}

/** One row of a drip: rounded across its width, so the relief lights it like a bead of wet paint. */
function paintRow(tiles: KnifeTiles, centre: number, y: number, width: number, colour: Rgb): void {
  const half = width / 2;
  for (let x = Math.floor(centre - half - 1); x <= Math.ceil(centre + half + 1); x++) {
    const tile = tiles.writable(x, y);
    const alpha = clamp01(half - Math.abs(x + 0.5 - centre) + 0.5);
    if (!tile || alpha <= 0) continue;
    const offset = (x + 0.5 - centre) / Math.max(half, 0.5);
    const bulge = Math.sqrt(Math.max(0, 1 - offset * offset));
    blend(tile, (y - tile.top) * TILE + (x - tile.left), colour, alpha * 0.95, bulge * Math.min(width, 12) * 0.35);
  }
}

function paintBead(tiles: KnifeTiles, centre: Point, width: number, colour: Rgb): void {
  const radiusX = width * 0.75;
  const radiusY = width * 1.05;
  for (let row = Math.floor(-radiusY); row <= Math.ceil(radiusY); row++) {
    const span = 2 * radiusX * Math.sqrt(Math.max(0, 1 - (row / radiusY) ** 2));
    if (span > 0.3) paintRow(tiles, centre.x, Math.round(centre.y + row), span, colour);
  }
}

/**
 * Wide where it leaves the stroke, still joined to it by a neck of paint, then
 * thinner as the paint runs out, swelling and wandering a little as it goes.
 */
function widthAt(drip: Drip, row: number): number {
  const fullness = 1 - row / drip.length;
  const swell = 0.82 + 0.36 * valueNoise1((drip.from.y + row) / (drip.width * 8), drip.seed + 3);
  const neck = 1.8 * Math.exp(-row / (drip.width * 2.2));
  return drip.width * (0.5 + 0.5 * Math.sqrt(fullness) + neck) * swell;
}

/** The drop at a drip's end, where the paint that ran down gathers. */
function dropWidth(drip: Drip): number {
  return drip.width * 1.45;
}

/**
 * Paint running down from where it was laid thickest. Each drip runs on its
 * own clock, slowing as it thins out, with a drop of paint at its front. The
 * drop moves, so it is painted after a checkpoint and rolled back each frame.
 */
export class DripRun implements Animation {
  private readonly tiles: KnifeTiles | null;
  private readonly drips: Drip[];
  private readonly started = performance.now();

  constructor(canvas: HTMLCanvasElement, specs: DripSpec[]) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    this.tiles = context ? new KnifeTiles(context) : null;
    this.drips = this.tiles ? specs.flatMap((spec) => this.loaded(spec)) : [];
  }

  get finished(): boolean {
    return this.drips.every((drip) => drip.finished);
  }

  frame(): void {
    this.runTo(performance.now() - this.started);
  }

  /** Lets every drip run its whole length at once. */
  finish(): void {
    this.runTo(Infinity);
  }

  private loaded(spec: DripSpec): Drip[] {
    const source = this.tiles ? paintAt(this.tiles, spec.from) : null;
    if (!source || source.coverage < LOADED) return [];
    return [{ ...spec, colour: wetColor(source.colour), laid: 0, x: spec.from.x, finished: false }];
  }

  private runTo(elapsed: number): void {
    const tiles = this.tiles;
    if (!tiles) return;
    tiles.rollback();
    for (const drip of this.drips) this.flow(tiles, drip, elapsed);
    tiles.checkpoint();
    for (const drip of this.drips) if (drip.laid > 0 && !drip.finished) paintBead(tiles, { x: drip.x, y: drip.from.y + drip.laid }, dropWidth(drip), drip.colour);
    tiles.render();
  }

  private flow(tiles: KnifeTiles, drip: Drip, elapsed: number): void {
    if (drip.finished) return;
    const progress = easeOutCubic(clamp01((elapsed - drip.delay) / drip.duration));
    const reached = Math.floor(drip.length * progress);
    if (drip.laid === 0 && reached > 0) paintBead(tiles, drip.from, drip.width * 1.6, drip.colour);
    for (; drip.laid < reached; drip.laid++) {
      paintRow(tiles, drip.x, Math.round(drip.from.y + drip.laid), widthAt(drip, drip.laid), drip.colour);
      drip.x += (valueNoise1((drip.from.y + drip.laid) / (drip.width * 20), drip.seed) - 0.5) * 0.12;
    }
    if (progress < 1) return;
    paintBead(tiles, { x: drip.x, y: drip.from.y + drip.laid }, dropWidth(drip), drip.colour);
    drip.finished = true;
  }
}
