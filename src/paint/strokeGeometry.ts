import type { Point } from "./knifePass";

export interface PathSample extends Point {
  /** Distance along the path from its first point, in canvas pixels. */
  distance: number;
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

/** A segment's curve depends on the pointer sample after it, so it stops changing once that sample exists. */
export function isSettled(points: Point[], index: number): boolean {
  return index + 2 < points.length;
}

/**
 * The curve from pointer sample `index` to the next, resampled every
 * `spacing` pixels so fast drags bend instead of kinking. Continues the
 * distance from `start`, the curve's sample at pointer sample `index`.
 */
export function smoothSegment(points: Point[], index: number, spacing: number, start: PathSample): PathSample[] {
  const quad = quadAround(points, index);
  const steps = Math.max(1, Math.ceil(gap(quad[1], quad[2]) / spacing));
  const samples: PathSample[] = [];
  let last = start;
  for (let step = 1; step <= steps; step++) {
    const point = splinePoint(quad, step / steps);
    last = { ...point, distance: last.distance + gap(last, point) };
    samples.push(last);
  }
  return samples;
}
