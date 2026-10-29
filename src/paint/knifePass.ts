/**
 * A palette knife dragged across a canvas in staggered bands. Laying draws a
 * painting in under the knife; scraping takes whatever is there back off.
 * Adapted from the Wet Paint studio's KnifeReveal.
 *
 * Every frame redraws a mask of where the knife has been, each lane as one
 * shape from where it set off to where it is now, and shows the painting
 * through it (laying) or cuts the mask out of what was there (scraping).
 * Painting or cutting only each frame's new slice instead would leave a faint
 * hairline wherever two slices meet, because each slice only half covers the
 * pixels on its antialiased edge. Drawing the painting straight into each lane
 * would also stack its translucent edges where lanes overlap.
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
  private readonly mask: HTMLCanvasElement;
  /** What the mask reveals when laying, or what it cuts into when scraping. */
  private readonly source: CanvasImageSource | null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly mode: PassMode,
    painting: CanvasImageSource | null = null,
    angle = sidewaysAngle(),
  ) {
    this.context = canvas.getContext("2d");
    this.mask = blankLike(canvas);
    this.source = mode === "lay" ? painting : copyOf(canvas);
    this.dir = { x: Math.cos(angle), y: Math.sin(angle) };
    this.normal = { x: -this.dir.y, y: this.dir.x };
    this.reach = Math.hypot(canvas.width, canvas.height);
    this.bandWidth = (this.reach / BANDS) * BAND_OVERLAP;
    this.bands = shuffledSlots().map((slot, index) => ({
      across: -this.reach / 2 + (slot + 0.5) * (this.reach / BANDS),
      delay: index * BAND_STAGGER_MS,
      lanes: laneSet(this.bandWidth),
    }));
  }

  get finished(): boolean {
    return performance.now() - this.started >= PASS_DURATION_MS;
  }

  frame(): void {
    const mask = this.mask.getContext("2d");
    if (!this.context || !mask) return;
    const elapsed = performance.now() - this.started;
    mask.clearRect(0, 0, this.mask.width, this.mask.height);
    for (const band of this.bands) this.traceBand(mask, band, elapsed);
    this.composite(this.context);
  }

  private composite(context: CanvasRenderingContext2D): void {
    if (!this.source) return;
    context.save();
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.drawImage(this.source, 0, 0, this.canvas.width, this.canvas.height);
    context.globalCompositeOperation = this.mode === "lay" ? "destination-in" : "destination-out";
    context.drawImage(this.mask, 0, 0);
    context.restore();
  }

  private traceBand(mask: CanvasRenderingContext2D, band: Band, elapsed: number): void {
    const progress = knifeEase(Math.min(1, Math.max(0, (elapsed - band.delay) / BAND_TRAVEL_MS)));
    if (progress <= 0) return;
    for (const lane of band.lanes) this.traceLane(mask, band, lane, progress);
  }

  private traceLane(mask: CanvasRenderingContext2D, band: Band, lane: Lane, progress: number): void {
    const from = this.pointOnBand(band, 0);
    const to = this.pointOnBand(band, Math.min(1, progress * lane.pace + (progress >= 1 ? 0.1 : 0)));
    quadPath(mask, from, to, this.normal, lane.offset, this.bandWidth / LANES + 0.6);
    mask.globalAlpha = this.mode === "scrape" ? lane.strength : 1;
    mask.fill();
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

function copyOf(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const copy = blankLike(canvas);
  copy.getContext("2d")?.drawImage(canvas, 0, 0);
  return copy;
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
