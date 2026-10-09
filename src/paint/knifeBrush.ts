import type { Point } from "./knifePass";

const LANES = 9;
/** How far, in CSS pixels, one load of paint lasts before the knife runs dry. */
const LOAD_LENGTH = 900;

interface Lane {
  offset: number;
  shade: number;
  nick: number;
}

function between(low: number, high: number): number {
  return low + Math.random() * (high - low);
}

function lanesFor(width: number): Lane[] {
  return Array.from({ length: LANES }, (_, index) => ({
    offset: -width / 2 + (index + 0.5) * (width / LANES),
    shade: between(-0.1, 0.1),
    nick: Math.random() < 0.14 ? between(0.15, 0.5) : between(0.85, 1),
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

/**
 * Lays streaky knife strokes where the pointer drags. Each lane of the blade
 * carries a slightly different shade, a few lanes are nicked and skip, and the
 * load thins out along the stroke the way paint does on a real knife.
 */
export class KnifeBrush {
  private lanes: Lane[] = [];
  private colour = "#000000";
  private travelled = 0;
  private colourIndex = Math.floor(Math.random() * 10);

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly palette: string[],
    private readonly width: number,
    private readonly scale: number,
  ) {}

  begin(): void {
    this.colour = this.palette[this.colourIndex++ % this.palette.length];
    this.lanes = lanesFor(this.width * this.scale);
    this.travelled = 0;
  }

  drag(from: Point, to: Point): void {
    const context = this.canvas.getContext("2d");
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (!context || length < 0.5) return;
    this.travelled += length / this.scale;
    const load = Math.max(0, 1 - this.travelled / LOAD_LENGTH);
    if (load <= 0) return;
    const across = { x: -(to.y - from.y) / length, y: (to.x - from.x) / length };
    const laneWidth = (this.width * this.scale) / LANES + 0.8;
    for (const lane of this.lanes) this.paintLane(context, { from, to, across }, lane, laneWidth, load);
  }

  private paintLane(
    context: CanvasRenderingContext2D,
    segment: { from: Point; to: Point; across: Point },
    lane: Lane,
    laneWidth: number,
    load: number,
  ): void {
    const { from, to, across } = segment;
    const near = lane.offset - laneWidth / 2;
    const far = lane.offset + laneWidth / 2;
    context.globalAlpha = Math.min(1, load * 1.6) * lane.nick;
    context.fillStyle = shaded(this.colour, lane.shade);
    context.beginPath();
    context.moveTo(from.x + across.x * near, from.y + across.y * near);
    context.lineTo(from.x + across.x * far, from.y + across.y * far);
    context.lineTo(to.x + across.x * far, to.y + across.y * far);
    context.lineTo(to.x + across.x * near, to.y + across.y * near);
    context.closePath();
    context.fill();
    context.globalAlpha = 1;
  }
}
