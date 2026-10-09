/**
 * Lifts portraits painted in the Wet Paint studio (canvas colour #f4f1ea) off
 * their canvas, so the paint sits straight on the page.
 *
 *   npx tsx scripts/portraits.mts boris=path/to/boris.png brendan=path/to/brendan.png
 */
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { fractalNoise2 } from "../src/paint/engine/random";
import { createImage, smoothstep } from "../src/paint/engine/raster";
import { keyOutPaper } from "./paper";

const SIZE = 1200;
/** How far in from the edge of the canvas the ragged edge can reach. */
const EDGE_FADE = 0.09;

/**
 * Paint the studio ran off the edge of its canvas would end in a ruler-straight
 * cut on the page. Cutting it back to a ragged, crisp edge makes it end the
 * way paint does; a soft fade would read as an airbrushed vignette.
 */
function raggedEdges(rgba: Uint8ClampedArray, width: number, height: number) {
  const band = Math.max(width, height) * EDGE_FADE;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nearest = Math.min(x, y, width - 1 - x, height - 1 - y);
      if (nearest >= band * 1.7) continue;
      const ragged = band * (0.25 + 1.4 * fractalNoise2(x / (band * 0.35), y / (band * 0.35), 41, 4));
      rgba[(y * width + x) * 4 + 3] *= smoothstep(ragged - 0.75, ragged + 0.75, nearest);
    }
  }
}

async function liftOffCanvas(name: string, source: string) {
  const { data, info } = await sharp(source).resize(SIZE, SIZE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const image = createImage(info.width, info.height);
  for (let i = 0; i < image.data.length; i++) image.data[i] = data[i] / 255;
  const rgba = keyOutPaper(image, true);
  raggedEdges(rgba, info.width, info.height);
  await sharp(Buffer.from(rgba.buffer), { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 86, alphaQuality: 90 })
    .toFile(`public/team/${name}.webp`);
}

await mkdir("public/team", { recursive: true });
for (const pair of process.argv.slice(2)) {
  const [name, source] = pair.split("=");
  await liftOffCanvas(name, source);
  console.log(name);
}
