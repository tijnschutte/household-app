// Dev FileStorage backend: writes under .uploads/ in the repo root (gitignored).
// Only used when BLOB_READ_WRITE_TOKEN isn't set (see index.ts).
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileStorage } from "@/src/lib/storage/types";

const ROOT = path.join(process.cwd(), ".uploads");

// Keys are always server-generated as `${householdId}/${crypto.randomUUID()}`
// (see the upload route) — never client-supplied — so this is a format
// assertion against programming errors, not a defense against an untrusted
// caller. It also rules out path traversal, since neither segment can
// contain "..", "/" or "\".
const KEY_RE = /^\d+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function resolvePath(key: string): string {
  if (!KEY_RE.test(key)) {
    throw new Error(`Ongeldige opslag-sleutel: ${key}`);
  }
  return path.join(ROOT, key);
}

export const localDiskStorage: FileStorage = {
  async put(key, data, _contentType) {
    const filePath = resolvePath(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
  },

  async get(key) {
    const filePath = resolvePath(key);
    try {
      const body = await readFile(filePath);
      // No sidecar metadata store for the dev backend — callers already have
      // the authoritative contentType from the Document row.
      return { body };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },

  async delete(key) {
    const filePath = resolvePath(key);
    await rm(filePath, { force: true });
  },
};
