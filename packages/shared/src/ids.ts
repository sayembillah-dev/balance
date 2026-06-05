import { uuidv7 } from 'uuidv7';

/**
 * App-side primary-key generator. UUIDv7 is time-ordered, which gives us index
 * locality in Postgres and free chronological sortability — and lets the future
 * offline-first mobile app mint IDs without server round-trips or collisions.
 *
 * Used by both the web app and the server so a record's ID is stable from the
 * moment it's created on any device.
 */
export function newId(): string {
  return uuidv7();
}
