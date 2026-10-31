const TILE = 256;

/** A rectangle in canvas pixels. */
export interface Area {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Square {
  left: number;
  top: number;
  canvas: HTMLCanvasElement;
}

function overlap(a: Area, b: Area): Area | null {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
}

function blankSquare(left: number, top: number): Square {
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  return { left, top, canvas };
}

/**
 * Paint laid on the page, kept in page coordinates so it can scroll with the
 * page while the canvas showing it stays on screen. Only the 256-pixel squares
 * that hold paint take memory.
 */
export class PaintLayer {
  private readonly squares = new Map<string, Square>();

  /** Copies what `source` shows in `area` into the layer, `offset` canvas pixels down the page. */
  absorb(source: HTMLCanvasElement, area: Area, offset: number): void {
    const shown = overlap(area, { left: 0, top: 0, width: source.width, height: source.height });
    if (!shown) return;
    const onPage = { ...shown, top: shown.top + offset };
    for (const square of this.squaresOver(onPage)) {
      const part = overlap(onPage, { left: square.left, top: square.top, width: TILE, height: TILE });
      const context = square.canvas.getContext("2d");
      if (!part || !context) continue;
      const left = part.left - square.left;
      const top = part.top - square.top;
      context.clearRect(left, top, part.width, part.height);
      context.drawImage(source, part.left, part.top - offset, part.width, part.height, left, top, part.width, part.height);
    }
  }

  /** Shows the stretch of the page that starts `offset` canvas pixels down on `context`'s canvas. */
  show(context: CanvasRenderingContext2D, offset: number): void {
    const { width, height } = context.canvas;
    context.clearRect(0, 0, width, height);
    for (const square of this.squares.values()) {
      if (square.top + TILE > offset && square.top < offset + height) context.drawImage(square.canvas, square.left, square.top - offset);
    }
  }

  /** The same paint stretched to a resized page, the way it would have been laid there. */
  resampled(scaleX: number, scaleY: number): PaintLayer {
    const resized = new PaintLayer();
    for (const square of this.squares.values()) {
      const area = { left: square.left * scaleX, top: square.top * scaleY, width: TILE * scaleX, height: TILE * scaleY };
      for (const target of resized.squaresOver(area)) {
        target.canvas.getContext("2d")?.drawImage(square.canvas, area.left - target.left, area.top - target.top, area.width, area.height);
      }
    }
    return resized;
  }

  private squaresOver(area: Area): Square[] {
    const squares: Square[] = [];
    for (let row = Math.floor(area.top / TILE); row * TILE < area.top + area.height; row++) {
      for (let column = Math.floor(area.left / TILE); column * TILE < area.left + area.width; column++) squares.push(this.square(column, row));
    }
    return squares;
  }

  private square(column: number, row: number): Square {
    const key = `${column},${row}`;
    const existing = this.squares.get(key);
    if (existing) return existing;
    const created = blankSquare(column * TILE, row * TILE);
    this.squares.set(key, created);
    return created;
  }
}
