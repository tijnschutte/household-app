// Shared between the upload route (server) and the upload dialog (client),
// so validation messages and limits never drift apart.

/** 4MB — comfortably under Vercel's own 4.5MB request body limit. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export function isAllowedContentType(contentType: string): contentType is AllowedContentType {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType);
}

/** Heading for documents without a category (categoryId == null). */
export const UNCATEGORIZED_LABEL = "Overig";

export const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
};
