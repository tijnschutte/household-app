// Single entry point for the docs vault's file storage. Everything outside
// src/lib/storage/ should import getStorage() from here, never a concrete
// backend module directly.
import type { FileStorage } from "@/src/lib/storage/types";
import { localDiskStorage } from "@/src/lib/storage/local-disk";
import { vercelBlobStorage } from "@/src/lib/storage/vercel-blob";

export type { FileStorage };

/** Vercel Blob in prod (once BLOB_READ_WRITE_TOKEN is provisioned), local disk in dev. */
export function getStorage(): FileStorage {
  return process.env.BLOB_READ_WRITE_TOKEN ? vercelBlobStorage : localDiskStorage;
}
