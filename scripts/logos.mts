/**
 * Draws the defect.tech logos: the wordmark in Dr Sugiyama, with the letters
 * turned into outlines so the files need no font to render.
 *
 *   npx tsx scripts/logos.mts
 *
 * Writes public/brand/<name>-<background>.svg and .png, on paper, white and
 * transparent grounds. The "d" also becomes the site's favicon.
 *
 * Each logo is centred by its optical box, not its bounding box. See
 * `opticalBox` below, and DESIGN.md in site-kit's starter for the same method
 * applied to pages.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import opentype from "opentype.js";
import sharp from "sharp";

const FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/drsugiyama/DrSugiyama-Regular.ttf";
const INK = "#17161a";
const OUT_DIR = "public/brand";
const FONT_SIZE = 400;

const GROUNDS = { paper: "#f4f1ea", white: "#ffffff", transparent: null } as const;
type Ground = keyof typeof GROUNDS;

type Box = { x1: number; y1: number; x2: number; y2: number };
type Frame = { width: number; height: number; offsetX: number; offsetY: number };
type Layout = { text: string; name: string; square: boolean; pngWidths: number[] };

const LAYOUTS: Layout[] = [
  { text: "defect.tech", name: "defect-tech", square: false, pngWidths: [1200, 2400] },
  { text: "defect", name: "defect", square: false, pngWidths: [1200, 2400] },
  { text: "d", name: "d", square: true, pngWidths: [180, 512, 1024] },
];

/** Blur radius for finding the optical box, as a share of the ink's height. */
const OPTICAL_BLUR = 0.08;
/** What share of the blurred ink's peak still counts as part of the shape. */
const OPTICAL_THRESHOLD = 0.3;
/** Room around a wordmark's optical box, as a share of that box's height. */
const WORDMARK_MARGIN = 0.45;
/** No ink may come closer to the edge than this, as a share of the optical box's height. */
const MIN_CLEARANCE = 0.12;
/** How much of the square the "d"'s optical box fills along its longer side. */
const MARK_FILL = 0.62;
/**
 * At 16 and 32 pixels the thin script strokes fade into the paper, so the
 * favicon's copy of the "d" gets an outline in its own ink to thicken it,
 * as a share of the square's side.
 */
const FAVICON_THICKENING = 0.021;

async function loadFont(): Promise<opentype.Font> {
  const response = await fetch(FONT_URL);
  if (!response.ok) throw new Error(`Couldn't download Dr Sugiyama: ${response.status}`);
  return opentype.parse(await response.arrayBuffer());
}

/**
 * Blur, crop, unblur. A bounding box counts every hairline: a long crossbar or
 * a descender pushes it out though the eye barely weighs them, so centring the
 * bounding box leaves the letters looking off-centre. Blurring the ink heavily
 * makes thin strokes fade and keeps the mass. The box around what is still
 * dark after the blur is the shape the eye centres. Position by that box, then
 * draw the sharp letters.
 */
async function opticalBox(svg: string, inkBox: Box): Promise<Box> {
  const sigma = Math.max(1, (inkBox.y2 - inkBox.y1) * OPTICAL_BLUR);
  const { data, info } = await sharp(Buffer.from(svg)).extractChannel("alpha").blur(sigma).raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let peak = 0;
  for (const value of data) peak = Math.max(peak, value);
  const box = { x1: width, y1: height, x2: 0, y2: 0 };
  for (let i = 0; i < data.length; i++) {
    if (data[i] < peak * OPTICAL_THRESHOLD) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    box.x1 = Math.min(box.x1, x);
    box.y1 = Math.min(box.y1, y);
    box.x2 = Math.max(box.x2, x + 1);
    box.y2 = Math.max(box.y2, y + 1);
  }
  return box;
}

/** Half the frame along one axis: the optical box plus its margin, or wider if ink would crowd the edge. */
function halfSpan(opticalLow: number, opticalHigh: number, inkLow: number, inkHigh: number, margin: number, clearance: number) {
  const centre = (opticalLow + opticalHigh) / 2;
  return Math.max((opticalHigh - opticalLow) / 2 + margin, centre - inkLow + clearance, inkHigh - centre + clearance);
}

function frameAround(optical: Box, ink: Box, square: boolean): Frame {
  const opticalHeight = optical.y2 - optical.y1;
  const margin = square ? 0 : opticalHeight * WORDMARK_MARGIN;
  const clearance = opticalHeight * MIN_CLEARANCE;
  let halfWidth = halfSpan(optical.x1, optical.x2, ink.x1, ink.x2, margin, clearance);
  let halfHeight = halfSpan(optical.y1, optical.y2, ink.y1, ink.y2, margin, clearance);
  if (square) {
    const opticalSide = Math.max(optical.x2 - optical.x1, opticalHeight) / MARK_FILL / 2;
    halfWidth = halfHeight = Math.max(halfWidth, halfHeight, opticalSide);
  }
  return {
    width: 2 * halfWidth,
    height: 2 * halfHeight,
    offsetX: halfWidth - (optical.x1 + optical.x2) / 2,
    offsetY: halfHeight - (optical.y1 + optical.y2) / 2,
  };
}

function svgFor(pathData: string, frame: Frame, ground: string | null, thickening = 0): string {
  const outline = thickening > 0 ? ` stroke="${INK}" stroke-width="${thickening}" stroke-linejoin="round"` : "";
  const fill = ground ? `\n  <rect width="100%" height="100%" fill="${ground}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${frame.width.toFixed(1)} ${frame.height.toFixed(1)}" width="${Math.round(frame.width)}" height="${Math.round(frame.height)}">${fill}
  <g transform="translate(${frame.offsetX.toFixed(2)} ${frame.offsetY.toFixed(2)})">
    <path fill="${INK}"${outline} d="${pathData}"/>
  </g>
</svg>
`;
}

async function writePngs(svg: string, name: string, frame: Frame, widths: number[]) {
  for (const width of widths) {
    const density = Math.max(72, (72 * width) / frame.width);
    await sharp(Buffer.from(svg), { density }).resize({ width }).png().toFile(`${OUT_DIR}/${name}-${width}.png`);
  }
}

/** Lays the glyphs out with their ink box starting a little way in from the origin, so the blur has room to spread. */
function placedGlyphs(font: opentype.Font, text: string) {
  const raw = font.getPath(text, 0, 0, FONT_SIZE).getBoundingBox();
  const pad = (raw.y2 - raw.y1) * 0.5;
  const path = font.getPath(text, pad - raw.x1, pad - raw.y1, FONT_SIZE);
  const ink: Box = { x1: pad, y1: pad, x2: pad + raw.x2 - raw.x1, y2: pad + raw.y2 - raw.y1 };
  return { pathData: path.toPathData(2), ink, canvas: { width: ink.x2 + pad, height: ink.y2 + pad } };
}

async function drawLogo(font: opentype.Font, layout: Layout) {
  const { pathData, ink, canvas } = placedGlyphs(font, layout.text);
  const measuring = svgFor(pathData, { ...canvas, offsetX: 0, offsetY: 0 }, null);
  const frame = frameAround(await opticalBox(measuring, ink), ink, layout.square);
  for (const [ground, colour] of Object.entries(GROUNDS) as [Ground, string | null][]) {
    const name = `${layout.name}-${ground}`;
    const svg = svgFor(pathData, frame, colour);
    await writeFile(`${OUT_DIR}/${name}.svg`, svg);
    await writePngs(svg, name, frame, layout.pngWidths);
  }
  if (layout.square) await writeFavicons(pathData, frame);
  console.log(`${layout.name} ${Math.round(frame.width)}×${Math.round(frame.height)}`);
}

async function writeFavicons(pathData: string, frame: Frame) {
  await writeFile("src/app/icon.svg", svgFor(pathData, frame, GROUNDS.paper, frame.width * FAVICON_THICKENING));
  await sharp(Buffer.from(svgFor(pathData, frame, GROUNDS.paper))).resize({ width: 180 }).png().toFile("src/app/apple-icon.png");
}

async function main() {
  const font = await loadFont();
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  for (const layout of LAYOUTS) await drawLogo(font, layout);
}

await main();
