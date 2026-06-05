import { env } from '../config/env.js';
import { LocalFsDriver } from './local.js';
import type { StorageDriver } from './driver.js';

let instance: StorageDriver | null = null;

/** Returns the configured storage driver (singleton). */
export function storage(): StorageDriver {
  if (!instance) {
    // STORAGE_DRIVER === 's3' would select an S3Driver here in the future.
    instance = new LocalFsDriver();
    if (env.STORAGE_DRIVER !== 'local') {
      console.warn(`STORAGE_DRIVER="${env.STORAGE_DRIVER}" not implemented; using local disk`);
    }
  }
  return instance;
}

export type { StorageDriver };
