import type { Readable } from 'node:stream';

/**
 * Pluggable blob storage. The default is local disk (a mounted volume); an
 * S3-compatible driver can be added later behind the same interface and selected
 * via the STORAGE_DRIVER env var. Records reference a blob by its `uploads` row
 * id, never by URL, so swapping drivers never requires rewriting data.
 */
export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  getStream(key: string): Readable;
  delete(key: string): Promise<void>;
}
