// Swappable file storage contract for the docs vault. `key` is always the
// server-generated `Document.storageKey` (`${householdId}/${uuid}`) — never
// anything client-supplied. Callers outside src/lib/storage/ only ever see
// this interface via getStorage(); they must not import a concrete backend
// (@vercel/blob, node:fs) directly.
export interface FileStorage {
  put(key: string, data: Buffer | Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream | Buffer; contentType?: string } | null>;
  delete(key: string): Promise<void>;
}
