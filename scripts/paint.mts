/**
 * Bakes every painted headline and the painted website sketch.
 *
 *   npx tsx scripts/paint.mts            paint everything
 *   npx tsx scripts/paint.mts oh wordmark   paint only these ids
 *
 * Chromium sets the text in the site's own fonts. Headlines are painted letter
 * by letter in their ink, on a transparent ground. The wordmark alone also
 * gets a band of knife strokes from the engine, keyed out against the paper so
 * it can overlap the page like a layer of real paint.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import sharp from "sharp";
import { ALL_HEADLINES, TYPEFACES, paintReach, type Headline } from "../src/content/headlines";
import { paintLetters, type PaintedLetters } from "./letterPainter";
import { PAPER, keyOutPaper } from "./paper";
import { SKETCH_HTML, SKETCH_SIZE } from "./sketch";
import { hexToRgb } from "../src/paint/engine/color";
import { defaultKnifeSettings, renderKnife, type KnifeSettings } from "../src/paint/engine/knife";
import { createField, createImage, imageToRgba, type Field, type RgbImage } from "../src/paint/engine/raster";

const FONT_SIZE = { display: 220, script: 300 };
const FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Big+Shoulders:opsz,wght@10..72,100..900&family=Dr+Sugiyama&display=block";
const OUT_DIR = "public/paint";
const MANIFEST = "src/content/paintings.json";

type Raster = { width: number; height: number; rgba: Buffer };

/**
 * The recipe the approved wordmark was painted with. Changing any of it
 * repaints the wordmark; the engine is deterministic for a given seed.
 */
const BAND_KNIFE: Partial<KnifeSettings> = {
  canvas: PAPER,
  strokeSize: 0.0075,
  detail: 1,
  margin: 0,
  dissolve: 0,
  haloAmount: 0.5,
  haloBlend: 0.3,
  largestHoleShare: 0,
  drips: 0.35,
  dripLength: 0.25,
  splatter: 0.25,
  dirt: 0.4,
  dryBrush: 0.5,
};
const BAND_REACH_EM = 0.22;

const SKETCH_KNIFE: Partial<KnifeSettings> = {
  canvas: PAPER,
  strokeSize: 0.02,
  detail: 0.7,
  margin: 0,
  dissolve: 0,
  haloAmount: 0,
  drips: 0.4,
};

function headlineHtml(headline: Headline): string {
  const face = TYPEFACES[headline.typeface];
  const size = FONT_SIZE[headline.typeface];
  const reach = paintReach(headline);
  const lines = headline.lines.map(escapeHtml).join("<br>");
  return `<!doctype html><html><head><link rel="stylesheet" href="${FONTS_CSS}"></head>
<body style="margin:0;background:transparent">
<div id="text" style="display:inline-block;white-space:pre;font-family:'${face.family}';font-weight:${face.weight};font-optical-sizing:none;font-size:${size}px;line-height:${face.lineHeight};color:${headline.ink};padding:${reach.y}em ${reach.x}em">${lines}</div>
</body></html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function screenshotRaw(page: Page, selector: string, transparent: boolean): Promise<Raster> {
  await page.evaluate(() => document.fonts.ready);
  const png = await page.locator(selector).screenshot({ omitBackground: transparent });
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, rgba: data };
}

function onPaper(raster: Raster): { image: RgbImage; coverage: Field } {
  const image = createImage(raster.width, raster.height);
  const coverage = createField(raster.width, raster.height);
  for (let p = 0; p < raster.width * raster.height; p++) {
    const alpha = raster.rgba[p * 4 + 3] / 255;
    coverage.data[p] = alpha;
    for (let c = 0; c < 3; c++) {
      image.data[p * 3 + c] = PAPER[c] * (1 - alpha) + (raster.rgba[p * 4 + c] / 255) * alpha;
    }
  }
  return { image, coverage };
}

function lettersToRgba(letters: PaintedLetters): Uint8ClampedArray {
  const rgba = imageToRgba(letters.color);
  for (let p = 0; p < letters.alpha.data.length; p++) rgba[p * 4 + 3] = Math.round(Math.min(1, letters.alpha.data[p]) * 255);
  return rgba;
}

async function writeWebp(path: string, rgba: Uint8ClampedArray | Buffer, width: number, height: number) {
  await sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), { raw: { width, height, channels: 4 } })
    .webp({ quality: 86, alphaQuality: 90 })
    .toFile(path);
}

/** The engine measures halo reach against the subject's width; the band is measured in ems. */
function haloSpreadFor(headline: Headline, rasterWidth: number): number {
  const size = FONT_SIZE[headline.typeface];
  const textWidth = rasterWidth - 2 * paintReach(headline).x * size;
  return (BAND_REACH_EM * size) / textWidth;
}

function paintBand(headline: Headline, band: string[], raster: Raster, overrides: Partial<KnifeSettings> = {}): Uint8ClampedArray {
  const { image, coverage } = onPaper(raster);
  const settings = {
    ...defaultKnifeSettings,
    ...BAND_KNIFE,
    haloSpread: haloSpreadFor(headline, raster.width),
    haloPalette: band.map(hexToRgb),
    seed: headline.seed,
    ...overrides,
  };
  return keyOutPaper(renderKnife(image, coverage, settings));
}

function paintBareLetters(headline: Headline, raster: Raster): Uint8ClampedArray {
  const { coverage } = onPaper(raster);
  return lettersToRgba(paintLetters(coverage, hexToRgb(headline.ink), headline.seed));
}

const DRIP_CHANGE = 3;

function differs(wet: Uint8ClampedArray, dry: Uint8ClampedArray, pixel: number): boolean {
  for (let c = 0; c < 4; c++) if (Math.abs(wet[pixel * 4 + c] - dry[pixel * 4 + c]) > DRIP_CHANGE) return true;
  return false;
}

/**
 * Drips run on their own random stream and are painted last, so a render with
 * them turned off matches the real one everywhere except the drips. Where the
 * two differ, plus a pixel of edge, is the drip layer the page lets run.
 */
function dripLayer(wet: Uint8ClampedArray, dry: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const layer = new Uint8ClampedArray(wet.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const near = [0, -1, 1].some((dy) => [0, -1, 1].some((dx) => inside(x + dx, y + dy, width, height) && differs(wet, dry, (y + dy) * width + x + dx)));
      if (near) layer.set(wet.subarray((y * width + x) * 4, (y * width + x) * 4 + 4), (y * width + x) * 4);
    }
  }
  return layer;
}

function inside(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

async function writeDripLayers(headline: Headline, band: string[], raster: Raster, wet: Uint8ClampedArray) {
  const dry = paintBand(headline, band, raster, { drips: 0 });
  await writeWebp(`${OUT_DIR}/${headline.id}-dry.webp`, dry, raster.width, raster.height);
  await writeWebp(`${OUT_DIR}/${headline.id}-drips.webp`, dripLayer(wet, dry, raster.width, raster.height), raster.width, raster.height);
}

async function paintHeadline(page: Page, headline: Headline) {
  await page.setContent(headlineHtml(headline), { waitUntil: "networkidle" });
  const raster = await screenshotRaw(page, "#text", true);
  const rgba = headline.band ? paintBand(headline, headline.band, raster) : paintBareLetters(headline, raster);
  await writeWebp(`${OUT_DIR}/${headline.id}.webp`, rgba, raster.width, raster.height);
  if (headline.band) await writeDripLayers(headline, headline.band, raster, rgba);
  return { width: raster.width, height: raster.height };
}

async function paintSketch(page: Page) {
  await page.setViewportSize(SKETCH_SIZE);
  await page.setContent(SKETCH_HTML, { waitUntil: "networkidle" });
  const raster = await screenshotRaw(page, "#sketch", false);
  const { image } = onPaper(raster);
  const whole = createField(raster.width, raster.height, 1);
  const painted = renderKnife(image, whole, { ...defaultKnifeSettings, ...SKETCH_KNIFE, seed: 97 });
  await writeWebp(`${OUT_DIR}/sketch-built.webp`, raster.rgba, raster.width, raster.height);
  await writeWebp(`${OUT_DIR}/sketch-painted.webp`, imageToRgba(painted), raster.width, raster.height);
}

async function readManifest(): Promise<Record<string, { width: number; height: number }>> {
  try {
    return (await import(`../${MANIFEST}`, { with: { type: "json" } })).default;
  } catch {
    return {};
  }
}

async function main() {
  const only = process.argv.slice(2);
  const wanted = (id: string) => only.length === 0 || only.includes(id);
  await mkdir(OUT_DIR, { recursive: true });
  const manifest = await readManifest();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    for (const headline of ALL_HEADLINES.filter((h) => wanted(h.id))) {
      const started = performance.now();
      manifest[headline.id] = await paintHeadline(page, headline);
      console.log(`${headline.id} ${Math.round(performance.now() - started)}ms`);
    }
    if (wanted("sketch")) await paintSketch(page);
  } finally {
    await browser.close();
  }
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

await main();
