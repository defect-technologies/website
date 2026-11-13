import "server-only";
import { put } from "@vercel/blob";
import { BOARD_LETTERS, BOARD_VIEWS, type BoardLetter, type BoardView } from "@/lib/boards";
import { BotError } from "../bots/http";
import { env } from "../env";

/** A board's picture is a JPEG of about 200 kB; anything much larger is not one. */
export const MAX_PICTURE_BYTES = 4 * 1024 * 1024;

/** Boards live beside the brand files, in the admin's own store, never in the client sites' store. */
export function boardFolder(businessId: string): string {
  return `boards/${businessId}/`;
}

function storeHost(): string {
  const storeId = env.brandFilesToken().split("_")[3] ?? "";
  return storeId ? `${storeId.toLowerCase()}.public.blob.vercel-storage.com` : "";
}

function inOurStore(url: string, folder: string): boolean {
  const parsed = URL.parse(url);
  return Boolean(parsed && parsed.protocol === "https:" && storeHost() !== "" && parsed.host === storeHost() && parsed.pathname.startsWith(`/${folder}`));
}

/** A picture the runner names only counts if it is in our store, in this lead's boards folder. */
export function isBoardPicture(url: string, businessId: string): boolean {
  return inOurStore(url, boardFolder(businessId));
}

/** A repair's before and after pictures live beside the boards, each lead's in its own folder. */
export function repairFolder(businessId: string): string {
  return `repairs/${businessId}/`;
}

export function isRepairPicture(url: string, businessId: string): boolean {
  return inOurStore(url, repairFolder(businessId));
}

/** "1-before" or "12-after": which note of the repair, and which side of it. */
export function isRepairPictureName(name: string): boolean {
  return /^[1-9]\d?-(before|after)$/.test(name);
}

/** "a-desktop" or "b-board": which option's picture, and which view of it. */
export function pictureName(name: string): { letter: BoardLetter; view: BoardView } | null {
  const [letter, view] = name.split("-");
  const known = (BOARD_LETTERS as readonly string[]).includes(letter) && (BOARD_VIEWS as readonly string[]).includes(view ?? "");
  return known ? { letter: letter as BoardLetter, view: view as BoardView } : null;
}

async function storePicture(folder: string, jobId: string, name: string, bytes: ArrayBuffer): Promise<string> {
  const token = env.brandFilesToken();
  if (!token) throw new BotError(503, "BRAND_FILES_READ_WRITE_TOKEN isn't set on the admin, so the runner's pictures can't be stored.");
  const stored = await put(`${folder}${jobId}/${name}.jpg`, bytes, { access: "public", token, contentType: "image/jpeg", addRandomSuffix: true });
  return stored.url;
}

export async function storeBoardPicture(businessId: string, jobId: string, name: string, bytes: ArrayBuffer): Promise<string> {
  return storePicture(boardFolder(businessId), jobId, name, bytes);
}

export async function storeRepairPicture(businessId: string, jobId: string, name: string, bytes: ArrayBuffer): Promise<string> {
  return storePicture(repairFolder(businessId), jobId, name, bytes);
}
