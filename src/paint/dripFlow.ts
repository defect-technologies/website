/**
 * Lets the drips of a painting run down after it has been laid. The drips live
 * in their own layer, baked by scripts/paint.mts; each one runs from its top
 * to its end on its own clock, slowing as it thins out.
 */
const VISIBLE_ALPHA = 8;
const LONGEST_RUN_MS = 2600;
const SHORTEST_RUN_MS = 700;
const LONGEST_DELAY_MS = 450;

type Drip = { left: number; right: number; top: number; bottom: number; delay: number; duration: number };
type Column = { top: number; bottom: number } | null;

const dripsBySource = new WeakMap<HTMLImageElement, Drip[]>();

function between(low: number, high: number): number {
  return low + Math.random() * (high - low);
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function columnExtent(pixels: Uint8ClampedArray, width: number, height: number, x: number): Column {
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    if (pixels[(y * width + x) * 4 + 3] <= VISIBLE_ALPHA) continue;
    if (top < 0) top = y;
    bottom = y + 1;
  }
  return top < 0 ? null : { top, bottom };
}

function timed(left: number, right: number, extent: { top: number; bottom: number }, height: number): Drip {
  const length = (extent.bottom - extent.top) / height;
  return {
    left,
    right,
    ...extent,
    delay: between(0, LONGEST_DELAY_MS),
    duration: (SHORTEST_RUN_MS + length * (LONGEST_RUN_MS - SHORTEST_RUN_MS)) * between(0.85, 1.2),
  };
}

/** Neighbouring columns with paint in them belong to the same drip and run together. */
function findDrips(layer: HTMLImageElement): Drip[] {
  const cached = dripsBySource.get(layer);
  if (cached) return cached;
  const { naturalWidth: width, naturalHeight: height } = layer;
  const scratch = document.createElement("canvas");
  scratch.width = width;
  scratch.height = height;
  const context = scratch.getContext("2d", { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(layer, 0, 0);
  const pixels = context.getImageData(0, 0, width, height).data;
  const drips: Drip[] = [];
  let open: { left: number; top: number; bottom: number } | null = null;
  for (let x = 0; x <= width; x++) {
    const column = x < width ? columnExtent(pixels, width, height, x) : null;
    if (column && open) open = { left: open.left, top: Math.min(open.top, column.top), bottom: Math.max(open.bottom, column.bottom) };
    else if (column) open = { left: x, ...column };
    else if (open) {
      drips.push(timed(open.left, x, open, height));
      open = null;
    }
  }
  dripsBySource.set(layer, drips);
  return drips;
}

export class DripFlow {
  private readonly context: CanvasRenderingContext2D | null;
  private readonly drips: Drip[];
  private readonly started = performance.now();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly dry: CanvasImageSource,
    private readonly layer: HTMLImageElement,
  ) {
    this.context = canvas.getContext("2d");
    this.drips = findDrips(layer);
  }

  get finished(): boolean {
    const elapsed = performance.now() - this.started;
    return this.drips.every((drip) => elapsed >= drip.delay + drip.duration);
  }

  frame(): void {
    const context = this.context;
    if (!context) return;
    const scaleX = this.canvas.width / this.layer.naturalWidth;
    const scaleY = this.canvas.height / this.layer.naturalHeight;
    const elapsed = performance.now() - this.started;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.drawImage(this.dry, 0, 0, this.canvas.width, this.canvas.height);
    for (const drip of this.drips) {
      const progress = easeOutCubic(Math.min(1, Math.max(0, (elapsed - drip.delay) / drip.duration)));
      const reached = drip.top + (drip.bottom - drip.top) * progress;
      if (reached <= drip.top) continue;
      const width = drip.right - drip.left;
      context.drawImage(this.layer, drip.left, 0, width, reached, drip.left * scaleX, 0, width * scaleX, reached * scaleY);
    }
  }
}
