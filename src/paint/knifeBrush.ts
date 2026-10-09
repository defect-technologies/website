import type { Point } from "./knifePass";

const LANES = 9;
/** How far, in CSS pixels, one load of paint lasts before the knife runs dry. */
const LOAD_LENGTH = 900;
/** Points this close together add nothing but jitter to the path. */
const MIN_STEP = 2;
/** How far the pointer travels before the blade's angle is set from the direction it went. */
const SETTLING_DISTANCE = 10;

interface Lane {
  offset: number;
  shade: number;
  opacity: number;
  /** How far this lane carries paint before it runs dry, in canvas pixels. */
  reach: number;
}

function between(low: number, high: number): number {
  return low + Math.random() * (high - low);
}

function lanesFor(width: number, scale: number): Lane[] {
  return Array.from({ length: LANES }, (_, index) => ({
    offset: -width / 2 + (index + 0.5) * (width / LANES),
    shade: between(-0.1, 0.1),
    opacity: Math.random() < 0.14 ? between(0.2, 0.5) : between(0.85, 1),
    reach: LOAD_LENGTH * scale * between(0.55, 1),
  }));
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
 * broad band, dragged along its length a thin one. Each lane is the whole path
 * shifted across the blade and drawn as one line with round joins, so corners
 * stay smooth. Lanes carry slightly different shades, a few are nicked and
 * thin, and each runs dry at its own distance the way paint gives out on a
 * real knife. The stroke is redrawn from a snapshot of the canvas on every
 * move, so paint never stacks on itself.
 */
export class KnifeBrush {
  private readonly lanes: Lane[];
  private readonly colour: string;
  private readonly before: HTMLCanvasElement;
  private readonly points: Point[];
  private readonly laneWidth: number;
  private across: Point | null = null;

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
  }

  drag(to: Point): void {
    const last = this.points[this.points.length - 1];
    if (Math.hypot(to.x - last.x, to.y - last.y) < MIN_STEP) return;
    this.points.push(to);
    this.across ??= this.settledBlade(to);
    if (this.across) this.redraw(this.across);
  }

  private settledBlade(to: Point): Point | null {
    const start = this.points[0];
    return Math.hypot(to.x - start.x, to.y - start.y) >= SETTLING_DISTANCE * this.scale ? bladeAcross(start, to) : null;
  }

  private redraw(across: Point): void {
    const context = this.canvas.getContext("2d");
    if (!context) return;
    context.save();
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.drawImage(this.before, 0, 0);
    context.lineWidth = this.laneWidth;
    context.lineJoin = "round";
    context.lineCap = "butt";
    for (const lane of this.lanes) this.paintLane(context, lane, across);
    context.restore();
  }

  private paintLane(context: CanvasRenderingContext2D, lane: Lane, across: Point): void {
    context.globalAlpha = lane.opacity;
    context.strokeStyle = shaded(this.colour, lane.shade);
    context.beginPath();
    let travelled = 0;
    for (let i = 0; i < this.points.length; i++) {
      const point = this.points[i];
      if (i > 0) travelled += Math.hypot(point.x - this.points[i - 1].x, point.y - this.points[i - 1].y);
      if (travelled > lane.reach) break;
      const x = point.x + across.x * lane.offset;
      const y = point.y + across.y * lane.offset;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
}
