import type { Point } from "./knifePass";

export interface PathSample extends Point {
  /** Distance along the path from its first point, in canvas pixels. */
  distance: number;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

type Quad = [Point, Point, Point, Point];

function gap(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function reflect(through: Point, point: Point): Point {
  return { x: 2 * through.x - point.x, y: 2 * through.y - point.y };
}

function mix(a: Point, b: Point, from: number, to: number, t: number): Point {
  const weight = (t - from) / (to - from);
  return { x: a.x + (b.x - a.x) * weight, y: a.y + (b.y - a.y) * weight };
}

function centripetalKnots(quad: Quad): number[] {
  const knots = [0];
  for (let i = 1; i < 4; i++) knots.push(knots[i - 1] + Math.max(Math.sqrt(gap(quad[i - 1], quad[i])), 1e-3));
  return knots;
}

/**
 * Barry and Goldman's form of the centripetal Catmull-Rom spline, between the
 * middle two points. Centripetal spacing keeps the curve from looping or
 * overshooting where pointer samples bunch up at slow, careful moments.
 */
function splinePoint(quad: Quad, u: number): Point {
  const [k0, k1, k2, k3] = centripetalKnots(quad);
  const t = k1 + (k2 - k1) * u;
  const a1 = mix(quad[0], quad[1], k0, k1, t);
  const a2 = mix(quad[1], quad[2], k1, k2, t);
  const a3 = mix(quad[2], quad[3], k2, k3, t);
  return mix(mix(a1, a2, k0, k2, t), mix(a2, a3, k1, k3, t), k1, k2, t);
}

function quadAround(points: Point[], index: number): Quad {
  const from = points[index];
  const to = points[index + 1];
  return [points[index - 1] ?? reflect(from, to), from, to, points[index + 2] ?? reflect(to, from)];
}

function append(samples: PathSample[], point: Point): void {
  const last = samples[samples.length - 1];
  samples.push({ ...point, distance: last.distance + gap(last, point) });
}

/** A curve through every pointer sample, resampled every `spacing` pixels, so fast drags bend instead of kinking. */
export function smoothPath(points: Point[], spacing: number): PathSample[] {
  const samples: PathSample[] = [{ ...points[0], distance: 0 }];
  for (let i = 0; i < points.length - 1; i++) {
    const quad = quadAround(points, i);
    const steps = Math.max(1, Math.ceil(gap(quad[1], quad[2]) / spacing));
    for (let step = 1; step <= steps; step++) append(samples, splinePoint(quad, step / steps));
  }
  return samples;
}

function sampleAt(samples: PathSample[], index: number, distance: number): PathSample {
  const before = samples[Math.max(0, index - 1)];
  const after = samples[index];
  const span = after.distance - before.distance;
  if (span <= 0) return { ...after, distance };
  return { ...mix(before, after, before.distance, after.distance, distance), distance };
}

/** The stretch of the path between two distances, with exact points at both ends. */
export function stretch(samples: PathSample[], from: number, to: number): PathSample[] {
  const first = samples.findIndex((sample) => sample.distance >= from);
  if (first < 0 || to <= from) return [];
  const inside = samples.filter((sample) => sample.distance > from && sample.distance < to);
  const last = samples.findIndex((sample) => sample.distance >= to);
  const end = last < 0 ? samples[samples.length - 1] : sampleAt(samples, last, to);
  return [sampleAt(samples, first, from), ...inside, end];
}

function normalAt(samples: PathSample[], index: number): Point {
  const before = samples[Math.max(0, index - 1)];
  const after = samples[Math.min(samples.length - 1, index + 1)];
  const length = gap(before, after) || 1;
  return { x: -(after.y - before.y) / length, y: (after.x - before.x) / length };
}

/**
 * Traces a filled ribbon along the samples, shifted by `shift`, whose half
 * width at each point comes from `halfWidth`. One closed shape per ribbon
 * means a translucent lane never darkens where its own pieces would overlap.
 */
export function traceRibbon(
  context: CanvasRenderingContext2D,
  samples: PathSample[],
  shift: Point,
  halfWidth: (distance: number) => number,
): void {
  const edge = (side: 1 | -1) =>
    samples.map((sample, index) => {
      const normal = normalAt(samples, index);
      const reach = halfWidth(sample.distance) * side;
      return { x: sample.x + shift.x + normal.x * reach, y: sample.y + shift.y + normal.y * reach };
    });
  const outline = [...edge(1), ...edge(-1).reverse()];
  context.beginPath();
  outline.forEach((point, index) => (index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)));
  context.closePath();
}

export function boundsOf(samples: PathSample[], padding: number): Bounds {
  const xs = samples.map((sample) => sample.x);
  const ys = samples.map((sample) => sample.y);
  return {
    left: Math.floor(Math.min(...xs) - padding),
    top: Math.floor(Math.min(...ys) - padding),
    right: Math.ceil(Math.max(...xs) + padding),
    bottom: Math.ceil(Math.max(...ys) + padding),
  };
}

export function union(a: Bounds | null, b: Bounds): Bounds {
  if (!a) return b;
  return {
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  };
}

export function clampTo(bounds: Bounds, width: number, height: number): Bounds {
  return {
    left: Math.max(0, bounds.left),
    top: Math.max(0, bounds.top),
    right: Math.min(width, bounds.right),
    bottom: Math.min(height, bounds.bottom),
  };
}
