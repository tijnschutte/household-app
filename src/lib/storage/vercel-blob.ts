// Production FileStorage backend on Vercel Blob. Blobs are created with
// access: "public" (Vercel Blob has no private-with-server-auth tier that
// works outside their client-upload flow), but that only matters for someone
// who already knows the exact random-UUID key — we never hand the blob URL
// to the client. All reads go through get() here, server-side, from our own
// authenticated download route.
import { del, get, put } from "@vercel/blob";
import type { FileStorage } from "@/src/lib/storage/types";

export const vercelBlobStorage: FileStorage = {
  async put(key, data, contentType) {
    // @vercel/blob's PutBody accepts Buffer but not a bare Uint8Array.
    const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
    await put(key, body, {
      access: "public",
      addRandomSuffix: false,
      contentType,
    });
  },

  async get(key) {
    const result = await get(key, { access: "public" });
    if (!result || result.statusCode !== 200) return null;
    return { body: result.stream, contentType: result.blob.contentType };
  },

  async delete(key) {
    await del(key);
  },
};
