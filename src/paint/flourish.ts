import { DripRun, type DripSpec } from "./dripRun";
import { KnifeBrush, type Loadout } from "./knifeBrush";
import type { Animation, Point } from "./knifePass";

/** Where a drip leaves a stroke, as a share of the way along it, and how it runs, in CSS pixels at full size. */
interface DripPlan {
  at: number;
  length: number;
  width: number;
}

/** One sweep of the knife around the wordmark, from one angle on the ellipse to another, in degrees. */
interface Arc {
  from: number;
  to: number;
  loadout: Loadout & { paint: string };
  drips: DripPlan[];
}

/**
 * Two knife strokes framing the wordmark: one over its top right, one under
 * its bottom left, each the other turned half way round, so they balance. Both
 * land on the ellipse's near-flat end, where a loaded knife leaves the most
 * paint, so that is where they drip.
 */
const ARCS: Arc[] = [
  {
    from: -74,
    to: -19,
    loadout: { paint: "#f4c26b", seed: 211, tilt: 0.18, ridgeSide: 1, traceMix: 0.35 },
    drips: [
      { at: 0.05, length: 62, width: 2.7 },
      { at: 0.14, length: 118, width: 3.4 },
      { at: 0.37, length: 34, width: 2.1 },
    ],
  },
  {
    from: 106,
    to: 161,
    loadout: { paint: "#3d5a80", seed: 587, tilt: -0.2, ridgeSide: -1, traceMix: 0.3 },
    drips: [
      { at: 0.04, length: 82, width: 3.2 },
      { at: 0.23, length: 40, width: 2.2 },
      { at: 0.3, length: 70, width: 2.6 },
    ],
  },
];

/** The knife a visitor paints with; the arcs use it around a full-size wordmark and a narrower one around a smaller wordmark. */
const FULL_KNIFE = 34;
const KNIFE_SHARE = 0.055;
const NARROWEST_KNIFE = 12;
/** The ellipse's radii, as shares of the wordmark painting's width. */
const RADIUS_X = 0.75;
const RADIUS_Y = 0.46;
/** Room below the ellipse for the drips, in CSS pixels at full size. */
const DRIP_ROOM = 130;
/** How far, in CSS pixels, the arcs keep from the sides of the screen. */
const SCREEN_EDGE = 12;
const KNIFE_SPEED = 0.7;
const BETWEEN_STROKES_MS = 140;
/** A load lasts a little past the arc's end, so each stroke runs dry into streaks just as it finishes. */
const LOAD_PAST_END = 1.1;

/** Where the strokes are painted, in CSS pixels: the canvas's size, where the wordmark's centre falls on it, and the knife's width. */
export interface FlourishLayout {
  width: number;
  height: number;
  centre: Point;
  radius: Point;
  knife: number;
  /** The composition's size against the full-size one, for the drips. */
  size: number;
}

export function flourishLayout(paintingWidth: number, screenWidth: number): FlourishLayout {
  const knife = Math.max(NARROWEST_KNIFE, Math.min(FULL_KNIFE, paintingWidth * KNIFE_SHARE));
  const size = knife / FULL_KNIFE;
  const radius = {
    x: Math.min(paintingWidth * RADIUS_X, screenWidth / 2 - knife / 2 - SCREEN_EDGE),
    y: paintingWidth * RADIUS_Y,
  };
  const margin = knife + 12;
  const centre = { x: radius.x + margin, y: radius.y + margin };
  return { width: centre.x * 2, height: centre.y * 2 + DRIP_ROOM * size, centre, radius, knife, size };
}

function arcPoints(arc: Arc, layout: FlourishLayout, scale: number): Point[] {
  const span = ((arc.to - arc.from) * Math.PI) / 180;
  const steps = Math.ceil((Math.abs(span) * Math.max(layout.radius.x, layout.radius.y)) / 4);
  return Array.from({ length: steps + 1 }, (_, step) => {
    const angle = ((arc.from * Math.PI) / 180) + (span * step) / steps;
    return {
      x: (layout.centre.x + Math.cos(angle) * layout.radius.x) * scale,
      y: (layout.centre.y + Math.sin(angle) * layout.radius.y) * scale,
    };
  });
}

function pathLength(points: Point[]): number {
  return points.reduce((total, point, i) => (i === 0 ? 0 : total + Math.hypot(point.x - points[i - 1].x, point.y - points[i - 1].y)), 0);
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

interface Sweep {
  arc: Arc;
  points: Point[];
  starts: number;
  duration: number;
  brush: KnifeBrush | null;
  fed: number;
}

/**
 * Paints the arcs with the same knife a visitor drags, one sweep after the
 * other, then lets them drip.
 */
export class FlourishPass implements Animation {
  private readonly sweeps: Sweep[];
  private readonly started = performance.now();
  private drips: DripRun | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly layout: FlourishLayout,
    private readonly scale: number,
  ) {
    let starts = 0;
    this.sweeps = ARCS.map((arc) => {
      const points = arcPoints(arc, layout, scale);
      const duration = pathLength(points) / scale / KNIFE_SPEED;
      const sweep = { arc, points, starts, duration, brush: null, fed: 0 };
      starts += duration + BETWEEN_STROKES_MS;
      return sweep;
    });
  }

  get finished(): boolean {
    return this.drips?.finished ?? false;
  }

  frame(): void {
    const elapsed = performance.now() - this.started;
    for (const sweep of this.sweeps) this.advance(sweep, elapsed);
    this.drips ??= this.sweeps.every((sweep) => sweep.fed === sweep.points.length) ? this.dripRun() : null;
    this.drips?.frame();
  }

  /** Paints both strokes and runs every drip to its end at once. */
  finish(): void {
    for (const sweep of this.sweeps) this.advance(sweep, Infinity);
    this.drips ??= this.dripRun();
    this.drips.finish();
  }

  private advance(sweep: Sweep, elapsed: number): void {
    const progress = easeInOut(Math.min(1, Math.max(0, (elapsed - sweep.starts) / sweep.duration)));
    const reached = progress >= 1 ? sweep.points.length : Math.ceil(progress * (sweep.points.length - 1));
    if (reached <= sweep.fed) return;
    sweep.brush ??= this.loadedBrush(sweep);
    sweep.brush.drag(sweep.points.slice(Math.max(1, sweep.fed), reached));
    sweep.fed = reached;
  }

  private loadedBrush(sweep: Sweep): KnifeBrush {
    const reach = pathLength(sweep.points) * LOAD_PAST_END;
    return new KnifeBrush(this.canvas, [sweep.arc.loadout.paint], this.layout.knife, this.scale, sweep.points[0], { ...sweep.arc.loadout, reach });
  }

  private dripRun(): DripRun {
    const specs = this.sweeps.flatMap((sweep) => sweep.arc.drips.flatMap((plan, index) => this.dripSpec(sweep, plan, index)));
    return new DripRun(this.canvas, specs);
  }

  private dripSpec(sweep: Sweep, plan: DripPlan, index: number): DripSpec[] {
    const from = sweep.brush?.lowerEdge(sweep.points[Math.round(plan.at * (sweep.points.length - 1))]);
    if (!from) return [];
    return [
      {
        from,
        length: plan.length * this.layout.size * this.scale,
        width: plan.width * this.layout.size * this.scale,
        delay: index * 160,
        duration: 700 + plan.length * 12,
        seed: (sweep.arc.loadout.seed ?? 0) + index * 17,
      },
    ];
  }
}
