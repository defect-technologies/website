/**
 * A palette knife dragged across a canvas in staggered bands. Laying draws a
 * painting in under the knife; scraping takes whatever is there back off.
 * Adapted from the Wet Paint studio's KnifeReveal.
 *
 * Laying grows a mask and draws the painting through it once per frame. Drawing
 * the painting straight into each lane instead would stack its translucent
 * edges where lanes overlap, so it would darken and then lighten again when the
 * finished image replaced the canvas.
 */
const LANES = 7;
const BANDS = 5;
const BAND_STAGGER_MS = 110;
const BAND_TRAVEL_MS = 620;
const BAND_OVERLAP = 1.35;

export const PASS_DURATION_MS = (BANDS - 1) * BAND_STAGGER_MS + BAND_TRAVEL_MS;

export type PassMode = "lay" | "scrape";

export interface Point {
  x: number;
  y: number;
}

interface Lane {
  offset: number;
  pace: number;
  strength: number;
}

interface Band {
  across: number;
  delay: number;
  reached: number;
  lanes: Lane[];
}

function between(low: number, high: number): number {
  return low + Math.random() * (high - low);
}

function knifeEase(t: number): number {
  return t * t * (3 - 2 * t);
}

function shuffledSlots(): number[] {
  const order = Array.from({ length: BANDS }, (_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    if (Math.random() < 0.35) [order[i], order[i - 1]] = [order[i - 1], order[i]];
  }
  return order;
}

function laneSet(width: number): Lane[] {
  return Array.from({ length: LANES }, (_, index) => ({
    offset: -width / 2 + (index + 0.5) * (width / LANES),
    pace: between(0.9, 1.08),
    strength: Math.random() < 0.18 ? between(0.55, 0.8) : 1,
  }));
}

/** Mostly sideways, the way a knife crosses a line of type, in either direction. */
function sidewaysAngle(): number {
  return between(-0.3, 0.3) + (Math.random() < 0.5 ? 0 : Math.PI);
}

function quadPath(context: CanvasRenderingContext2D, from: Point, to: Point, across: Point, offset: number, width: number) {
  const near = offset - width / 2;
  const far = offset + width / 2;
  context.beginPath();
  context.moveTo(from.x + across.x * near, from.y + across.y * near);
  context.lineTo(from.x + across.x * far, from.y + across.y * far);
  context.lineTo(to.x + across.x * far, to.y + across.y * far);
  context.lineTo(to.x + across.x * near, to.y + across.y * near);
  context.closePath();
}

export class KnifePass {
  private readonly context: CanvasRenderingContext2D | null;
  private readonly dir: Point;
  private readonly normal: Point;
  private readonly reach: number;
  private readonly bandWidth: number;
  private readonly bands: Band[];
  private readonly started = performance.now();
  private readonly mask: HTMLCanvasElement | null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly mode: PassMode,
    private readonly painting: CanvasImageSource | null = null,
    angle = sidewaysAngle(),
  ) {
    this.context = canvas.getContext("2d");
    this.mask = mode === "lay" ? blankLike(canvas) : null;
    this.dir = { x: Math.cos(angle), y: Math.sin(angle) };
    this.normal = { x: -this.dir.y, y: this.dir.x };
    this.reach = Math.hypot(canvas.width, canvas.height);
    this.bandWidth = (this.reach / BANDS) * BAND_OVERLAP;
    this.bands = shuffledSlots().map((slot, index) => ({
      across: -this.reach / 2 + (slot + 0.5) * (this.reach / BANDS),
      delay: index * BAND_STAGGER_MS,
      reached: 0,
      lanes: laneSet(this.bandWidth),
    }));
  }

  get finished(): boolean {
    return performance.now() - this.started >= PASS_DURATION_MS;
  }

  frame(): void {
    if (!this.context) return;
    const elapsed = performance.now() - this.started;
    const target = this.mask?.getContext("2d") ?? this.context;
    if (!target) return;
    for (const band of this.bands) this.advance(target, band, elapsed);
    if (this.mask) this.showThroughMask(this.context, this.mask);
  }

  private showThroughMask(context: CanvasRenderingContext2D, mask: HTMLCanvasElement): void {
    if (!this.painting) return;
    context.save();
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.drawImage(this.painting, 0, 0, this.canvas.width, this.canvas.height);
    context.globalCompositeOperation = "destination-in";
    context.drawImage(mask, 0, 0);
    context.restore();
  }

  private advance(context: CanvasRenderingContext2D, band: Band, elapsed: number): void {
    const progress = knifeEase(Math.min(1, Math.max(0, (elapsed - band.delay) / BAND_TRAVEL_MS)));
    if (progress <= band.reached) return;
    for (const lane of band.lanes) this.stroke(context, band, lane, progress);
    band.reached = progress;
  }

  private stroke(context: CanvasRenderingContext2D, band: Band, lane: Lane, progress: number): void {
    const from = this.pointOnBand(band, Math.min(1, band.reached * lane.pace));
    const to = this.pointOnBand(band, Math.min(1, progress * lane.pace + (progress >= 1 ? 0.1 : 0)));
    context.save();
    quadPath(context, from, to, this.normal, lane.offset, this.bandWidth / LANES + 0.6);
    if (this.mode === "scrape") {
      context.globalCompositeOperation = "destination-out";
      context.globalAlpha = lane.strength;
    }
    context.fill();
    context.restore();
  }

  private pointOnBand(band: Band, travel: number): Point {
    const along = -this.reach / 2 + travel * this.reach;
    return {
      x: this.canvas.width / 2 + this.dir.x * along + this.normal.x * band.across,
      y: this.canvas.height / 2 + this.dir.y * along + this.normal.y * band.across,
    };
  }
}

function blankLike(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const blank = document.createElement("canvas");
  blank.width = canvas.width;
  blank.height = canvas.height;
  return blank;
}

/** Scrapes a knife-wide path between two points, for dragging by hand. Round ends let consecutive drags join without gaps at the turns. */
export function scrapeAlong(canvas: HTMLCanvasElement, from: Point, to: Point, width: number): void {
  const context = canvas.getContext("2d");
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (!context || length < 0.5) return;
  const across = { x: -(to.y - from.y) / length, y: (to.x - from.x) / length };
  context.save();
  context.globalCompositeOperation = "destination-out";
  context.lineCap = "round";
  context.lineWidth = width / LANES + 0.6;
  for (const lane of laneSet(width)) {
    context.globalAlpha = lane.strength;
    context.beginPath();
    context.moveTo(from.x + across.x * lane.offset, from.y + across.y * lane.offset);
    context.lineTo(to.x + across.x * lane.offset, to.y + across.y * lane.offset);
    context.stroke();
  }
  context.restore();
}

export type Animation = { frame(): void; readonly finished: boolean };

/** Plays an animation to the end, then resolves. Cancelling stops it where it is. */
export function play(pass: Animation): { done: Promise<void>; cancel: () => void } {
  let frame = 0;
  let cancelled = false;
  const done = new Promise<void>((resolve) => {
    const tick = () => {
      if (cancelled) return resolve();
      pass.frame();
      if (pass.finished) return resolve();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  });
  return {
    done,
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    },
  };
}
