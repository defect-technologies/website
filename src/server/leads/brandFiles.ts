import "server-only";
import { del } from "@vercel/blob";
import { and, asc, count, eq } from "drizzle-orm";
import { brandFolder, MAX_BRAND_FILES } from "@/lib/brandFiles";
import { record } from "../activity";
import { db } from "../db/client";
import { brandFiles, type BrandFile } from "../db/schema";
import { env } from "../env";

export async function brandFilesFor(businessId: string): Promise<BrandFile[]> {
  return (await db()).select().from(brandFiles).where(eq(brandFiles.businessId, businessId)).orderBy(asc(brandFiles.createdAt));
}

export async function brandFileCount(businessId: string): Promise<number> {
  const [row] = await (await db()).select({ total: count() }).from(brandFiles).where(eq(brandFiles.businessId, businessId));
  return row?.total ?? 0;
}

/** The store's ID is the third part of its read-write token, and its public files are served from <id>.public.blob.vercel-storage.com. */
function storeHost(): string {
  const storeId = env.brandFilesToken().split("_")[3] ?? "";
  return storeId ? `${storeId.toLowerCase()}.public.blob.vercel-storage.com` : "";
}

/** A file the browser says it uploaded only counts if it's in our store, in this lead's folder. */
export function isUploadFor(url: string, businessId: string): boolean {
  const parsed = URL.parse(url);
  return Boolean(parsed && parsed.protocol === "https:" && parsed.host === storeHost() && parsed.pathname.startsWith(`/${brandFolder(businessId)}`));
}

export type NewBrandFile = { businessId: string; url: string; name: string; contentType: string; size: number };

export async function saveBrandFile(file: NewBrandFile, by: string): Promise<void> {
  if ((await brandFileCount(file.businessId)) >= MAX_BRAND_FILES) throw new Error(`A lead can have ${MAX_BRAND_FILES} brand files. Remove one first.`);
  await (await db()).insert(brandFiles).values({ ...file, addedBy: by });
  await record(by, "added a brand file", { businessId: file.businessId, detail: file.name });
}

export async function removeBrandFile(id: string, businessId: string, by: string): Promise<void> {
  const [removed] = await (await db())
    .delete(brandFiles)
    .where(and(eq(brandFiles.id, id), eq(brandFiles.businessId, businessId)))
    .returning();
  if (!removed) return;
  await del(removed.url, { token: env.brandFilesToken() });
  await record(by, "removed a brand file", { businessId, detail: removed.name });
}
