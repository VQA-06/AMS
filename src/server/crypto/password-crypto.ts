/**
 * Web Crypto PBKDF2 Password Hashing Utility
 * Maximum supported iteration count on Cloudflare Workers edge runtime is 100,000 iterations for PBKDF2-HMAC-SHA256.
 * Backwards-compatible verification for legacy 30,000 iteration hashes.
 */

import { timingSafeEqualStrings } from './timing-safe';

export const DEFAULT_PBKDF2_ITERATIONS = 100000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: DEFAULT_PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const hashHex = Array.from(new Uint8Array(derivedKey))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${saltHex}:${hashHex}`;
}

async function derivePbkdf2Hex(
  keyMaterial: CryptoKey,
  salt: BufferSource,
  iterations: number
): Promise<string | null> {
  try {
    const derivedKey = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    return Array.from(new Uint8Array(derivedKey))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

export async function verifyPasswordAndCheckUpgrade(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  try {
    if (!storedHash || !storedHash.includes(':')) return { valid: false, needsUpgrade: false };

    const parts = storedHash.split(':');
    if (parts.length !== 2) return { valid: false, needsUpgrade: false };

    const [saltHex, originalHashHex] = parts;
    const match = saltHex.match(/.{1,2}/g);
    if (!match) return { valid: false, needsUpgrade: false };

    const salt = new Uint8Array(match.map((byte) => parseInt(byte, 16)));
    const enc = new TextEncoder();

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    // 1. Primary verification: standard 100,000 iterations (Cloudflare Workers platform ceiling)
    const hashHex100k = await derivePbkdf2Hex(keyMaterial, salt, DEFAULT_PBKDF2_ITERATIONS);
    if (hashHex100k && timingSafeEqualStrings(hashHex100k, originalHashHex)) {
      return { valid: true, needsUpgrade: false };
    }

    // 2. Fallback verification: legacy 30,000 iterations (flags for upgrade)
    const hashHex30k = await derivePbkdf2Hex(keyMaterial, salt, 30000);
    if (hashHex30k && timingSafeEqualStrings(hashHex30k, originalHashHex)) {
      return { valid: true, needsUpgrade: true };
    }

    return { valid: false, needsUpgrade: false };
  } catch {
    return { valid: false, needsUpgrade: false };
  }
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const { valid } = await verifyPasswordAndCheckUpgrade(password, storedHash);
  return valid;
}
