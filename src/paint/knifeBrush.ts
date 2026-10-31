import { hexToRgb, srgbToOklch } from "./engine/color";
import type { Point } from "./knifePass";
import { sweep, type Blade, type Tip } from "./knifeSweep";
import { KnifeTiles } from "./knifeTiles";
import { isSettled, smoothSegment, type PathSample } from "./strokeGeometry";

/** How far, in CSS pixels, one load of paint lasts before the knife runs dry. */
const LOAD_LENGTH = 900;
/** Points this close together, in CSS pixels, add nothing but jitter to the path. */
const MIN_STEP = 2;
/** How far the pointer travels before the blade's angle is set from the direction it went. */
const SETTLING_DISTANCE = 10;
/** How finely, in CSS pixels, the smoothed path is sampled. */
const SAMPLE_SPACING = 1.5;
/** Paint further behind the knife than this many half-widths no longer changes as it moves. */
const SET_BEHIND = 1.2;

function between(low: number, high: number): number {
  return low + Math.random() * (high - low);
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function hueGap(a: string, b: string): number {
  const gap = Math.abs(srgbToOklch(hexToRgb(a))[2] - srgbToOklch(hexToRgb(b))[2]) % (2 * Math.PI);
  return Math.min(gap, 2 * Math.PI - gap);
}

/** The palette paint nearest in hue, the only kind of trace that streaks through a colour without turning it to mud. */
function nearestHue(palette: readonly string[], paint: string): string {
  const others = palette.filter((other) => other !== paint);
  return others.reduce((nearest, other) => (hueGap(paint, other) < hueGap(paint, nearest) ? other : nearest), others[0] ?? paint);
}

function loadedBlade(palette: readonly string[], width: number, scale: number, start: Point, to: Point): Blade {
  const length = Math.hypot(to.x - start.x, to.y - start.y) || 1;
  const facing = { x: (to.x - start.x) / length, y: (to.y - start.y) / length };
  const paint = pick(palette);
  return {
    along: { x: -facing.y, y: facing.x },
    facing,
    half: (width * scale) / 2,
    scale,
    reach: LOAD_LENGTH * scale * between(0.75, 1.05),
    paint: hexToRgb(paint),
    trace: hexToRgb(nearestHue(palette, paint)),
    traceMix: Math.random() < 0.5 ? between(0.25, 0.6) : 0,
    tilt: between(-0.35, 0.35),
    ridgeSide: Math.random() < 0.5 ? -1 : 1,
    seed: Math.floor(Math.random() * 9973),
  };
}

/**
 * Lays a palette knife stroke where the pointer drags. Like a real knife, the
 * blade keeps the angle it set off at: dragged sideways it lays a broad band,
 * dragged along its length a thin one. The pointer's path is smoothed into a
 * curve and the blade is swept along it pixel by pixel (see knifeSweep), onto
 * whatever paint is already on the canvas. Paint well behind the knife is set;
 * the stretch near it is laid again on every move, because the curve and the
 * roll of paint in front of the blade move with the pointer.
 */
export class KnifeBrush {
  private readonly points: Point[];
  private readonly tiles: KnifeTiles | null;
  private blade: Blade | null = null;
  /** The smoothed path through every pointer sample whose curve can no longer change. */
  private readonly settled: PathSample[];
  private settledSegments = 0;
  /** How many of the settled samples' stretches have been laid for good. */
  private set = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly palette: readonly string[],
    private readonly width: number,
    private readonly scale: number,
    start: Point,
  ) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    this.tiles = context ? new KnifeTiles(context) : null;
    this.points = [start];
    this.settled = [{ ...start, distance: 0 }];
  }

  /** Takes every pointer position since the last move, so a fast drag keeps its shape. */
  drag(moves: Point[]): void {
    for (const to of moves) this.follow(to);
    this.blade ??= this.settledBlade();
    if (this.blade && this.tiles) this.lay(this.blade, this.tiles);
  }

  private follow(to: Point): void {
    const last = this.points[this.points.length - 1];
    if (Math.hypot(to.x - last.x, to.y - last.y) >= MIN_STEP * this.scale) this.points.push(to);
  }

  private settledBlade(): Blade | null {
    const start = this.points[0];
    const to = this.points[this.points.length - 1];
    if (Math.hypot(to.x - start.x, to.y - start.y) < SETTLING_DISTANCE * this.scale) return null;
    return loadedBlade(this.palette, this.width, this.scale, start, to);
  }

  private lay(blade: Blade, tiles: KnifeTiles): void {
    this.settle();
    const moving = this.unsettledPath();
    const tip = { distance: (moving[moving.length - 1] ?? this.settled[this.settled.length - 1]).distance };
    tiles.rollback();
    this.setBehind(blade, tiles, tip);
    tiles.checkpoint();
    const near = [...this.settled.slice(this.set), ...moving];
    for (let i = 1; i < near.length; i++) this.sweepStretch(blade, tiles, near[i - 1], near[i], tip);
    tiles.render();
  }

  private settle(): void {
    while (isSettled(this.points, this.settledSegments)) {
      const start = this.settled[this.settled.length - 1];
      this.settled.push(...smoothSegment(this.points, this.settledSegments, this.spacing, start));
      this.settledSegments++;
    }
  }

  private unsettledPath(): PathSample[] {
    const path: PathSample[] = [];
    for (let index = this.settledSegments; index < this.points.length - 1; index++) {
      const start = path[path.length - 1] ?? this.settled[this.settled.length - 1];
      path.push(...smoothSegment(this.points, index, this.spacing, start));
    }
    return path;
  }

  private setBehind(blade: Blade, tiles: KnifeTiles, tip: Tip): void {
    const settledUpTo = tip.distance - SET_BEHIND * blade.half;
    while (this.set + 1 < this.settled.length && this.settled[this.set + 1].distance <= settledUpTo) {
      this.sweepStretch(blade, tiles, this.settled[this.set], this.settled[this.set + 1], tip);
      this.set++;
    }
  }

  private sweepStretch(blade: Blade, tiles: KnifeTiles, from: PathSample, to: PathSample, tip: Tip): void {
    if (from.distance < blade.reach) sweep(tiles, blade, from, to, tip);
  }

  private get spacing(): number {
    return SAMPLE_SPACING * this.scale;
  }
}
