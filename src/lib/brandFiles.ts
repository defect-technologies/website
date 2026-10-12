/** What the builder can look at and put on a page. Illustrator and PDF files need exporting to one of these first. */
export const BRAND_FILE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
export const BRAND_FILE_ACCEPT = ".png,.jpg,.jpeg,.webp,.svg";
export const MAX_BRAND_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_BRAND_FILES = 20;

/** Where a lead's files live in the store. Uploads are only accepted under their own lead's folder. */
export const brandFolder = (businessId: string) => `brand/${businessId}/`;
