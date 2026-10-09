/**
 * Draws the defect.tech logos: the wordmark in Dr Sugiyama, ink on paper, with
 * the letters turned into outlines so the files need no font to render.
 *
 *   npx tsx scripts/logos.mts
 *
 * Writes public/brand/*, and the "d" also becomes the site's favicon.
 */
import { mkdir, writeFile } from "node:fs/promises";
import opentype from "opentype.js";
import sharp from "sharp";

const FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/drsugiyama/DrSugiyama-Regular.ttf";
const INK = "#17161a";
const PAPER = "#f4f1ea";
const OUT_DIR = "public/brand";
const FONT_SIZE = 400;

type Logo = { name: string; svg: string; width: number; height: number; favicon?: string };

type Layout = { text: string; name: string; square: boolean; pngWidths: number[] };

const LAYOUTS: Layout[] = [
  { text: "defect.tech", name: "defect-tech", square: false, pngWidths: [1200, 2400] },
  { text: "defect", name: "defect", square: false, pngWidths: [1200, 2400] },
  { text: "d", name: "d", square: true, pngWidths: [180, 512, 1024] },
];

/** Room around a wordmark, as a share of the letters' height. */
const WORDMARK_MARGIN = 0.35;
/** How much of the square the "d" fills along its longer side. */
const MARK_FILL = 0.8;
/**
 * At 16 and 32 pixels the thin script strokes fade into the paper, so the
 * favicon's copy of the "d" gets an outline in its own ink to thicken it.
 * The full-size files keep the true letterform.
 */
const FAVICON_THICKENING = 22;

async function loadFont(): Promise<opentype.Font> {
  const response = await fetch(FONT_URL);
  if (!response.ok) throw new Error(`Couldn't download Dr Sugiyama: ${response.status}`);
  return opentype.parse(await response.arrayBuffer());
}

function svgFor(pathData: string, width: number, height: number, thickening = 0): string {
  const outline = thickening > 0 ? ` stroke="${INK}" stroke-width="${thickening}" stroke-linejoin="round"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(1)} ${height.toFixed(1)}" width="${Math.round(width)}" height="${Math.round(height)}">
  <rect width="100%" height="100%" fill="${PAPER}"/>
  <path fill="${INK}"${outline} d="${pathData}"/>
</svg>
`;
}

function wordmark(font: opentype.Font, layout: Layout): Logo {
  const box = font.getPath(layout.text, 0, 0, FONT_SIZE).getBoundingBox();
  const margin = (box.y2 - box.y1) * WORDMARK_MARGIN;
  const width = box.x2 - box.x1 + 2 * margin;
  const height = box.y2 - box.y1 + 2 * margin;
  const path = font.getPath(layout.text, margin - box.x1, margin - box.y1, FONT_SIZE);
  return { name: layout.name, svg: svgFor(path.toPathData(2), width, height), width, height };
}

function squareMark(font: opentype.Font, layout: Layout): Logo {
  const side = 1024;
  const box = font.getPath(layout.text, 0, 0, FONT_SIZE).getBoundingBox();
  const scale = (side * MARK_FILL) / Math.max(box.x2 - box.x1, box.y2 - box.y1);
  const size = FONT_SIZE * scale;
  const glyphWidth = (box.x2 - box.x1) * scale;
  const glyphHeight = (box.y2 - box.y1) * scale;
  const x = (side - glyphWidth) / 2 - box.x1 * scale;
  const y = (side - glyphHeight) / 2 - box.y1 * scale;
  const pathData = font.getPath(layout.text, x, y, size).toPathData(2);
  return {
    name: layout.name,
    svg: svgFor(pathData, side, side),
    favicon: svgFor(pathData, side, side, FAVICON_THICKENING),
    width: side,
    height: side,
  };
}

async function writePngs(logo: Logo, widths: number[]) {
  for (const width of widths) {
    const density = Math.max(72, (72 * width) / logo.width);
    await sharp(Buffer.from(logo.svg), { density })
      .resize({ width })
      .png()
      .toFile(`${OUT_DIR}/${logo.name}-${width}.png`);
  }
}

async function main() {
  const font = await loadFont();
  await mkdir(OUT_DIR, { recursive: true });
  for (const layout of LAYOUTS) {
    const logo = layout.square ? squareMark(font, layout) : wordmark(font, layout);
    await writeFile(`${OUT_DIR}/${logo.name}.svg`, logo.svg);
    await writePngs(logo, layout.pngWidths);
    if (logo.favicon) {
      await writeFile("src/app/icon.svg", logo.favicon);
      await sharp(Buffer.from(logo.svg)).resize({ width: 180 }).png().toFile("src/app/apple-icon.png");
    }
    console.log(`${logo.name} ${Math.round(logo.width)}×${Math.round(logo.height)}`);
  }
}

await main();
