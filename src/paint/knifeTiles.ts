import { reliefLight } from "./engine/knife/relief";
import type { Area } from "./paintLayer";

export const TILE = 64;

/**
 * Wet paint for one 64-pixel square of the canvas. Colour is premultiplied by
 * coverage, so laying paint is one blend per channel. Thickness is only this
 * stroke's paint, which is all the relief lighting needs.
 */
export interface Tile {
  left: number;
  top: number;
  colour: Float32Array;
  coverage: Float32Array;
  thickness: Float32Array;
}

interface Saved {
  colour: Float32Array;
  coverage: Float32Array;
  thickness: Float32Array;
}

const RELIEF_STRENGTH = 0.75;

function keyOf(column: number, row: number): number {
  return row * 65536 + column;
}

function savedCopy(tile: Tile): Saved {
  return { colour: tile.colour.slice(), coverage: tile.coverage.slice(), thickness: tile.thickness.slice() };
}

function tileFrom(pixels: ImageData, left: number, top: number): Tile {
  const count = TILE * TILE;
  const colour = new Float32Array(count * 3);
  const coverage = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const alpha = pixels.data[i * 4 + 3] / 255;
    coverage[i] = alpha;
    for (let c = 0; c < 3; c++) colour[i * 3 + c] = (pixels.data[i * 4 + c] / 255) * alpha;
  }
  return { left, top, colour, coverage, thickness: new Float32Array(count) };
}

/**
 * The paint one knife stroke is laying, kept in tiles that are read from the
 * canvas the first time the stroke reaches them, so the stroke paints onto
 * whatever was already there. The tip of a stroke still moves as the pointer
 * does, so it is laid after a checkpoint and rolled back on the next move.
 */
export class KnifeTiles {
  private readonly tiles = new Map<number, Tile>();
  private readonly dirty = new Set<number>();
  private saved: Map<number, Saved> | null = null;

  constructor(private readonly context: CanvasRenderingContext2D) {}

  /** The tile holding a canvas pixel, ready to be painted on. */
  writable(x: number, y: number): Tile | null {
    if (x < 0 || y < 0 || x >= this.context.canvas.width || y >= this.context.canvas.height) return null;
    const key = keyOf(Math.floor(x / TILE), Math.floor(y / TILE));
    const tile = this.tiles.get(key) ?? this.read(key, x, y);
    if (this.saved && !this.saved.has(key)) this.saved.set(key, savedCopy(tile));
    this.dirty.add(key);
    return tile;
  }

  checkpoint(): void {
    this.saved = new Map();
  }

  rollback(): void {
    for (const [key, saved] of this.saved ?? []) {
      const tile = this.tiles.get(key);
      if (!tile) continue;
      tile.colour.set(saved.colour);
      tile.coverage.set(saved.coverage);
      tile.thickness.set(saved.thickness);
      this.dirty.add(key);
    }
    this.saved = null;
  }

  /** The part of the canvas this stroke has reached, in canvas pixels. */
  area(): Area | null {
    const tiles = [...this.tiles.values()];
    if (tiles.length === 0) return null;
    const left = Math.min(...tiles.map((tile) => tile.left));
    const top = Math.min(...tiles.map((tile) => tile.top));
    const right = Math.max(...tiles.map((tile) => tile.left + TILE));
    const bottom = Math.max(...tiles.map((tile) => tile.top + TILE));
    return { left, top, width: right - left, height: bottom - top };
  }

  /** Lights every tile painted or rolled back since the last render and puts it on the canvas. */
  render(): void {
    for (const key of this.dirty) {
      const tile = this.tiles.get(key);
      if (tile) this.context.putImageData(this.lit(tile), tile.left, tile.top);
    }
    this.dirty.clear();
  }

  private read(key: number, x: number, y: number): Tile {
    const left = Math.floor(x / TILE) * TILE;
    const top = Math.floor(y / TILE) * TILE;
    const tile = tileFrom(this.context.getImageData(left, top, TILE, TILE), left, top);
    this.tiles.set(key, tile);
    return tile;
  }

  private thicknessAt(tile: Tile, x: number, y: number): number {
    if (x >= 0 && y >= 0 && x < TILE && y < TILE) return tile.thickness[y * TILE + x];
    const neighbour = this.tiles.get(keyOf(Math.floor((tile.left + x) / TILE), Math.floor((tile.top + y) / TILE)));
    if (!neighbour) return 0;
    return neighbour.thickness[(tile.top + y - neighbour.top) * TILE + (tile.left + x - neighbour.left)];
  }

  /** Sobel slopes of the paint's thickness, so the relief reads ridges rather than single-pixel noise. */
  private slope(tile: Tile, x: number, y: number): [number, number] {
    const at = (dx: number, dy: number) => this.thicknessAt(tile, x + dx, y + dy);
    const gx = (at(1, -1) + 2 * at(1, 0) + at(1, 1) - at(-1, -1) - 2 * at(-1, 0) - at(-1, 1)) / 8;
    const gy = (at(-1, 1) + 2 * at(0, 1) + at(1, 1) - at(-1, -1) - 2 * at(0, -1) - at(1, -1)) / 8;
    return [gx, gy];
  }

  private lit(tile: Tile): ImageData {
    const image = new ImageData(TILE, TILE);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) this.litPixel(tile, x, y, image.data);
    }
    return image;
  }

  private litPixel(tile: Tile, x: number, y: number, out: Uint8ClampedArray): void {
    const i = y * TILE + x;
    const coverage = tile.coverage[i];
    if (coverage <= 0) return;
    const [gx, gy] = this.slope(tile, x, y);
    const { shade, gloss } = reliefLight(gx, gy, RELIEF_STRENGTH);
    for (let c = 0; c < 3; c++) out[i * 4 + c] = ((tile.colour[i * 3 + c] / coverage) * shade + gloss) * 255;
    out[i * 4 + 3] = coverage * 255;
  }
}
