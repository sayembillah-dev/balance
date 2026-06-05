import argon2 from 'argon2';

/**
 * Password hashing with argon2id (memory-hard, resistant to GPU attacks, and no
 * 72-byte input cap like bcrypt). Defaults from the argon2 lib are sensible for
 * an interactive login on self-host hardware.
 */
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
