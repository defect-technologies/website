/**
 * Paints a portrait photo with the knife engine on the studio's paper, for
 * scripts/portraits.mts to lift off the canvas afterwards.
 *
 *   npx tsx scripts/paintPortrait.mts photo.png mask.png painted.png
 *
 * The mask is white where the person is and black for the background, at the
 * photo's size.
 */
import sharp from "sharp";
import { defaultKnifeSettings, renderKnife } from "../src/paint/engine/knife";
import { createField, createImage, imageToRgba } from "../src/paint/engine/raster";
import { PAPER } from "./paper";

const [photoPath, maskPath, outPath] = process.argv.slice(2);

async function readPhoto(path: string) {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const image = createImage(info.width, info.height);
  for (let i = 0; i < image.data.length; i++) image.data[i] = data[i] / 255;
  return image;
}

async function readMask(path: string, width: number, height: number) {
  const { data } = await sharp(path).resize(width, height).greyscale().raw().toBuffer({ resolveWithObject: true });
  const mask = createField(width, height);
  for (let i = 0; i < mask.data.length; i++) mask.data[i] = data[i] / 255;
  return mask;
}

const photo = await readPhoto(photoPath);
const mask = await readMask(maskPath, photo.width, photo.height);
const painted = renderKnife(photo, mask, { ...defaultKnifeSettings, canvas: PAPER }, (progress, step) =>
  console.log(`${Math.round(progress * 100)}% ${step}`),
);
const rgba = imageToRgba(painted);
await sharp(Buffer.from(rgba.buffer), { raw: { width: painted.width, height: painted.height, channels: 4 } })
  .png()
  .toFile(outPath);
