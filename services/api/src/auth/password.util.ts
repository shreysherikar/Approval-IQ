import { scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcryptjs') as {
  hash(pw: string, rounds: number): Promise<string>;
  compare(pw: string, hash: string): Promise<boolean>;
};

const scryptAsync = promisify(scryptCb);

/**
 * Password hashing with graceful fallback.
 *
 * Default is pure-JS bcryptjs (bcrypt, cost 10): no native build, so it never
 * trips Windows Application Control policies that block argon2's native
 * .node binary — and, critically, the choice is DETERMINISTIC per process
 * (an intermittent argon2 native load caused hash-on-register vs
 * fail-on-verify mismatches in long-running servers).
 *
 * Set PASSWORD_HASHER=argon2 to prefer argon2 in production (its native
 * implementation is faster and memory-hard). Whatever the hasher, every
 * stored format is verified by the matching implementation:
 *  - `$argon2…`   → argon2 (only when its native module actually loads)
 *  - `$2a/$2b/$2y$…` → bcryptjs
 *  - `scrypt$…`   → Node built-in scrypt (last-resort fallback)
 */
export type PasswordHasher = 'bcrypt' | 'argon2';

export function activeHasher(): PasswordHasher {
  return process.env.PASSWORD_HASHER === 'argon2' ? 'argon2' : 'bcrypt';
}

function getArgon2(): { hash(pw: string): Promise<string>; verify(hash: string, pw: string): Promise<boolean> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('argon2') as {
      hash(pw: string): Promise<string>;
      verify(hash: string, pw: string): Promise<boolean>;
    };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  if (activeHasher() === 'argon2') {
    const argon2 = getArgon2();
    if (argon2) return argon2.hash(password);
    // argon2 requested but unusable on this machine → fall through to bcrypt
    // so the app never becomes unable to register users.
  }
  // Pure-JS bcrypt — no native build, deterministic, never blocked by policy.
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  if (storedHash.startsWith('$argon2')) {
    // An argon2-format hash: only argon2 can verify it. If the native module
    // is unavailable/blocked on this machine we cannot check the password at
    // all (fail closed, never guess).
    const argon2 = getArgon2();
    if (!argon2) return false;
    try {
      return await argon2.verify(storedHash, password);
    } catch {
      return false;
    }
  }
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    try {
      return await bcrypt.compare(password, storedHash);
    } catch {
      return false;
    }
  }
  if (storedHash.startsWith('scrypt$')) {
    const [, saltHex, hashHex] = storedHash.split('$');
    if (!saltHex || !hashHex) return false;
    try {
      const derived = (await scryptAsync(password, Buffer.from(saltHex, 'hex'), 64)) as Buffer;
      const expected = Buffer.from(hashHex, 'hex');
      return derived.length === expected.length && timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }
  // Unknown format — reject rather than guessing.
  return false;
}
