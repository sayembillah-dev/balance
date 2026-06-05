import { createReadStream } from 'node:fs';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { env } from '../config/env.js';
import type { StorageDriver } from './driver.js';

/** Stores blobs as files under `${DATA_DIR}/uploads` (a Docker volume in prod). */
export class LocalFsDriver implements StorageDriver {
  private readonly base = resolve(env.DATA_DIR, 'uploads');

  private pathFor(key: string): string {
    return resolve(this.base, key);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const p = this.pathFor(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }

  getStream(key: string): Readable {
    return createReadStream(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    await unlink(this.pathFor(key)).catch(() => {});
  }
}
