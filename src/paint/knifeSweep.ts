import type { Rgb } from "./engine/color";
import { knifeTexture, type KnifeTexture } from "./engine/knife/stroke";
import { valueNoise1, valueNoise2 } from "./engine/random";
import { clamp01, smoothstep } from "./engine/raster";
import type { Point } from "./knifePass";
import { TILE, type KnifeTiles, type Tile } from "./knifeTiles";
import type { PathSample } from "./strokeGeometry";

/** A loaded palette knife, held at one angle for the whole stroke. */
export interface Blade {
  /** Unit vector along the blade's edge. */
  along: Point;
  /** Unit vector square to the edge, the way the blade sweeps paint. */
  facing: Point;
  /** Half the blade's width, in canvas pixels. */
  half: number;
  /** Canvas pixels per CSS pixel. */
  scale: number;
  /** How far, in canvas pixels, the load of paint lasts. */
  reach: number;
  paint: Rgb;
  /** A second colour the knife picked up from the palette, streaked through the first. */
  trace: Rgb;
  traceMix: number;
  /** How far one corner of the blade touched down before the other, as a share of its width; the sign picks the corner. */
  tilt: number;
  /** Which long edge squeezes out the heavier ridge of paint. */
  ridgeSide: number;
  seed: number;
}

/** Where the paint along a stretch ends: at the knife, which is still moving or has lifted. */
export interface Tip {
  distance: number;
}

const DRY_FROM = 0.5;
const PICKUP = 0.35;

function chipped(blade: Blade, across: number, salt: number): number {
  const coarse = valueNoise1(across / (blade.half * 0.22), blade.seed + salt);
  const fine = valueNoise1(across / (blade.half * 0.06), blade.seed + salt + 1);
  return 0.65 * coarse + 0.35 * fine;
}

/** The ragged line where the knife touched down: its edge, a little crooked, torn where paint didn't take. */
function landingEdge(blade: Blade, across: number): number {
  const leading = (Math.sign(blade.tilt) * (across / blade.half) + 1) / 2;
  const corner = Math.abs(blade.tilt) * leading;
  return blade.half * (corner + 0.22 * chipped(blade, across, 11));
}

/** The edge in front of the knife, where the paint it pushes ends. */
function frontEdge(blade: Blade, across: number): number {
  return blade.half * 0.12 * chipped(blade, across, 23);
}

function sideEdge(blade: Blade, distance: number): number {
  return blade.half * (1 + 0.05 * (valueNoise1(distance / (blade.half * 2.5), blade.seed + 31) - 0.5));
}

interface Spot {
  x: number;
  y: number;
  distance: number;
  across: number;
}

/** The canvas weave under the paint: the high points take paint first as the knife runs dry. */
function tooth(x: number, y: number, scale: number): number {
  const cssX = x / scale;
  const cssY = y / scale;
  return 0.6 * valueNoise2(cssX * 0.7, cssY * 0.7, 5) + 0.4 * valueNoise2(cssX * 0.23, cssY * 0.23, 11);
}

/**
 * How high the surface stands where the blade passes: the canvas weave, and
 * the ridges the blade's own edge drags along with it. A drying knife skips in
 * long streaks the way it is dragged, not in specks.
 */
function surfaceAt(blade: Blade, spot: Spot): number {
  const cssAcross = spot.across / blade.scale;
  const cssDistance = spot.distance / blade.scale;
  const skips = valueNoise2(cssAcross / 1.3, cssDistance / 22, blade.seed + 41);
  const broad = valueNoise2(cssAcross / 5, cssDistance / 60, blade.seed + 43);
  return 0.35 * tooth(spot.x, spot.y, blade.scale) + 0.4 * skips + 0.25 * broad;
}

/** How much paint still reaches the canvas: all of it at first, then only the high points, streaked along the blade. */
function loadCoverage(blade: Blade, spot: Spot, texture: KnifeTexture): number {
  const dryness = clamp01((spot.distance / blade.reach - DRY_FROM) / (1 - DRY_FROM));
  const reach = 1 - 1.25 * dryness - 0.45 * (texture.striation - 0.5) * smoothstep(0, 0.3, dryness);
  return smoothstep(-0.1, 0.1, reach - (1 - surfaceAt(blade, spot))) * (1 - Math.exp(-4 * (0.25 + clamp01(reach))));
}

function coverageAt(blade: Blade, spot: Spot, tip: Tip, texture: KnifeTexture): number {
  const side = clamp01(sideEdge(blade, spot.distance) - Math.abs(spot.across) + 0.5);
  const landed = clamp01(spot.distance - landingEdge(blade, spot.across) + 0.5);
  const front = clamp01(tip.distance - frontEdge(blade, spot.across) - spot.distance + 0.5);
  return side * landed * front * loadCoverage(blade, spot, texture);
}

/** Paint stands thickest where the knife landed, along its edges, and in the roll it pushes in front of it. */
function thicknessAt(blade: Blade, spot: Spot, tip: Tip, texture: KnifeTexture): number {
  const v = Math.abs(spot.across) / blade.half;
  const body = texture.bodyThickness + 0.35 * (texture.striation - 0.5);
  const squeezed = 0.35 * smoothstep(0.78, 1, v);
  const landing = 0.45 * (1 - smoothstep(0, blade.half * 0.7, spot.distance - landingEdge(blade, spot.across)));
  const pushed = 0.6 * (1 - smoothstep(0, blade.half * 0.9, tip.distance - spot.distance));
  const remaining = 1 - clamp01(spot.distance / blade.reach);
  return (body + squeezed + landing + pushed) * (0.45 + 0.55 * remaining) * blade.scale;
}

function pigment(blade: Blade, texture: KnifeTexture, channel: number): number {
  const traced = blade.traceMix * smoothstep(0.42, 0.72, texture.marble);
  const base = blade.paint[channel] + (blade.trace[channel] - blade.paint[channel]) * traced;
  return base * (1 + (texture.striation - 0.5) * 0.06);
}

function deposit(tile: Tile, index: number, blade: Blade, spot: Spot, tip: Tip, texture: KnifeTexture): void {
  const alpha = coverageAt(blade, spot, tip, texture);
  if (alpha <= 0.002) return;
  const below = tile.coverage[index];
  const streak = 0.3 + 1.4 * smoothstep(0.35, 0.65, texture.marble);
  const pickup = Math.min(1, PICKUP * (1 - smoothstep(0, blade.reach * 0.2, spot.distance)) * below * streak);
  for (let c = 0; c < 3; c++) {
    const own = pigment(blade, texture, c);
    const under = below > 0 ? tile.colour[index * 3 + c] / below : own;
    const mixed = own + (under - own) * pickup;
    tile.colour[index * 3 + c] = tile.colour[index * 3 + c] * (1 - alpha) + mixed * alpha;
  }
  tile.coverage[index] = below * (1 - alpha) + alpha;
  const previous = tile.thickness[index];
  tile.thickness[index] = previous + (previous * 0.3 + thicknessAt(blade, spot, tip, texture) - previous) * alpha;
}

function paintSpot(tiles: KnifeTiles, blade: Blade, spot: Spot, tip: Tip): void {
  const tile = tiles.writable(spot.x, spot.y);
  if (!tile) return;
  const index = (spot.y - tile.top) * TILE + (spot.x - tile.left);
  const v = spot.across / blade.half;
  const u = spot.distance / (blade.half * 6);
  const texture = knifeTexture(spot.across / blade.scale, u, v, blade.seed, blade.half / blade.scale, blade.ridgeSide);
  deposit(tile, index, blade, spot, tip, texture);
}

function sweptBox(blade: Blade, from: Point, to: Point) {
  const reach = blade.half * 1.06;
  const xs = [from.x, to.x].flatMap((x) => [x - blade.along.x * reach, x + blade.along.x * reach]);
  const ys = [from.y, to.y].flatMap((y) => [y - blade.along.y * reach, y + blade.along.y * reach]);
  return {
    left: Math.floor(Math.min(...xs)),
    top: Math.floor(Math.min(...ys)),
    right: Math.ceil(Math.max(...xs)),
    bottom: Math.ceil(Math.max(...ys)),
  };
}

/**
 * Where a pixel sits under the blade as it moves from `from` to `to`: the
 * moment the blade's edge crosses the pixel gives how far the knife had
 * travelled, and the point on the edge that crosses it gives which part of
 * the blade laid its paint. A knife held at one angle sweeps parallelograms
 * that meet exactly, so neighbouring stretches leave no seam.
 */
function spotUnder(blade: Blade, from: PathSample, to: PathSample, x: number, y: number): Spot | null {
  const stepX = to.x - from.x;
  const stepY = to.y - from.y;
  const sweep = stepX * blade.facing.x + stepY * blade.facing.y;
  if (Math.abs(sweep) < 1e-6) return null;
  const offsetX = x + 0.5 - from.x;
  const offsetY = y + 0.5 - from.y;
  const t = (offsetX * blade.facing.x + offsetY * blade.facing.y) / sweep;
  if (t < 0 || t >= 1) return null;
  const across = (offsetX - t * stepX) * blade.along.x + (offsetY - t * stepY) * blade.along.y;
  if (Math.abs(across) > blade.half * 1.06) return null;
  return { x, y, distance: from.distance + t * (to.distance - from.distance), across };
}

/** Lays the paint the knife leaves moving from one path sample to the next. */
export function sweep(tiles: KnifeTiles, blade: Blade, from: PathSample, to: PathSample, tip: Tip): void {
  const box = sweptBox(blade, from, to);
  for (let y = box.top; y <= box.bottom; y++) {
    for (let x = box.left; x <= box.right; x++) {
      const spot = spotUnder(blade, from, to, x, y);
      if (spot) paintSpot(tiles, blade, spot, tip);
    }
  }
}
