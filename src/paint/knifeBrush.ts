import type { Point } from "./knifePass";
import { boundsOf, clampTo, smoothPath, stretch, traceRibbon, union, type Bounds, type PathSample } from "./strokeGeometry";

const LANES = 9;
/** How far, in CSS pixels, one load of paint lasts before the knife runs dry. */
const LOAD_LENGTH = 900;
/** Points this close together, in CSS pixels, add nothing but jitter to the path. */
const MIN_STEP = 2;
/** How far the pointer travels before the blade's angle is set from the direction it went. */
const SETTLING_DISTANCE = 10;
/** How finely, in CSS pixels, the smoothed path is sampled. */
const SAMPLE_SPACING = 1.5;

interface Lane {
  offset: number;
  shade: number;
  opacity: number;
  /** How far this lane carries paint before it runs dry, in canvas pixels. */
  reach: number;
  /** How long the lane spends thinning out as it runs dry, in canvas pixels. */
  thinning: number;
  /** How far behind the knife's first touch this lane starts, so the leading edge isn't a ruled line. */
  lead: number;
}

function between(low: number, high: number): number {
  return low + Math.random() * (high - low);
}

function lanesFor(width: number, scale: number): Lane[] {
  return Array.from({ length: LANES }, (_, index) => {
    const reach = LOAD_LENGTH * scale * between(0.55, 1);
    return {
      offset: -width / 2 + (index + 0.5) * (width / LANES),
      shade: between(-0.1, 0.1),
      opacity: Math.random() < 0.14 ? between(0.2, 0.5) : between(0.85, 1),
      reach,
      thinning: reach * between(0.18, 0.35),
      lead: between(0, 1.6) * (width / LANES),
    };
  });
}

/** A round end of the given radius: zero at the tip, full width one radius in. */
function roundEnd(distanceFromTip: number, radius: number): number {
  const inward = Math.min(1, Math.max(0, distanceFromTip / radius));
  return Math.sqrt(1 - (1 - inward) ** 2);
}

/** Paint giving out: the lane narrows to a point over its last stretch instead of stopping square. */
function runningDry(distance: number, lane: Lane): number {
  return Math.min(1, Math.max(0, (lane.reach - distance) / lane.thinning)) ** 0.6;
}

function shaded(hex: string, amount: number): string {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const base = (value >> shift) & 255;
    const target = amount > 0 ? 255 : 0;
    return Math.round(base + (target - base) * Math.abs(amount));
  };
  return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`;
}

/** Square across the direction the stroke set off in. */
function bladeAcross(from: Point, to: Point): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: -(to.y - from.y) / length, y: (to.x - from.x) / length };
}

function copyOf(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext("2d")?.drawImage(canvas, 0, 0);
  return copy;
}

/**
 * Lays streaky knife strokes where the pointer drags. Like a real palette
 * knife, the blade keeps the angle it set off at: dragged sideways it lays a
 * broad band, dragged along its length a thin one. The pointer's path is
 * smoothed into a curve, and each lane is that curve shifted across the blade
 * and filled as a ribbon with rounded ends. Lanes carry slightly different
 * shades, a few are nicked and thin, each starts a little behind the others,
 * and each narrows to a point at its own distance the way paint gives out on a
 * real knife. The stroke is redrawn from a snapshot of the canvas on every
 * move, only where it lies, so paint never stacks on itself.
 */
export class KnifeBrush {
  private readonly lanes: Lane[];
  private readonly colour: string;
  private readonly before: HTMLCanvasElement;
  private readonly points: Point[];
  private readonly laneWidth: number;
  private readonly bladeWidth: number;
  private across: Point | null = null;
  private painted: Bounds | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    palette: string[],
    width: number,
    private readonly scale: number,
    start: Point,
  ) {
    this.colour = palette[Math.floor(Math.random() * palette.length)];
    this.lanes = lanesFor(width * scale, scale);
    this.before = copyOf(canvas);
    this.points = [start];
    this.laneWidth = (width * scale) / LANES + 0.8;
    this.bladeWidth = width * scale;
  }

  /** Takes every pointer position since the last move, so a fast drag keeps its shape. */
  drag(moves: Point[]): void {
    for (const to of moves) this.follow(to);
    this.across ??= this.settledBlade(this.points[this.points.length - 1]);
    if (this.across) this.redraw(this.across);
  }

  private follow(to: Point): void {
    const last = this.points[this.points.length - 1];
    if (Math.hypot(to.x - last.x, to.y - last.y) >= MIN_STEP * this.scale) this.points.push(to);
  }

  private settledBlade(to: Point): Point | null {
    const start = this.points[0];
    return Math.hypot(to.x - start.x, to.y - start.y) >= SETTLING_DISTANCE * this.scale ? bladeAcross(start, to) : null;
  }

  private redraw(across: Point): void {
    const context = this.canvas.getContext("2d");
    if (!context) return;
    const path = smoothPath(this.points, SAMPLE_SPACING * this.scale);
    const reached = boundsOf(path, this.bladeWidth / 2 + this.laneWidth);
    const area = clampTo(union(this.painted, reached), this.canvas.width, this.canvas.height);
    this.painted = reached;
    const width = area.right - area.left;
    const height = area.bottom - area.top;
    if (width <= 0 || height <= 0) return;
    context.save();
    context.beginPath();
    context.rect(area.left, area.top, width, height);
    context.clip();
    context.clearRect(area.left, area.top, width, height);
    context.drawImage(this.before, area.left, area.top, width, height, area.left, area.top, width, height);
    for (const lane of this.lanes) this.paintLane(context, lane, path, across);
    context.restore();
  }

  private paintLane(context: CanvasRenderingContext2D, lane: Lane, path: PathSample[], across: Point): void {
    const end = Math.min(path[path.length - 1].distance, lane.reach);
    const samples = stretch(path, lane.lead, end);
    if (samples.length < 2) return;
    const half = this.laneWidth / 2;
    const halfWidth = (distance: number) =>
      half * roundEnd(distance - lane.lead, half) * roundEnd(end - distance, half) * runningDry(distance, lane);
    traceRibbon(context, samples, { x: across.x * lane.offset, y: across.y * lane.offset }, halfWidth);
    context.globalAlpha = lane.opacity;
    context.fillStyle = shaded(this.colour, lane.shade);
    context.fill();
  }
}
