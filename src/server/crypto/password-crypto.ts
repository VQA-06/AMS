/**
 * Web Crypto PBKDF2 Password Hashing Utility
 * OWASP 2024/2026 standard 600,000 iterations for PBKDF2-HMAC-SHA256.
 * Backwards-compatible verification for legacy 30,000 and 100,000 iteration hashes.
 */

import { timingSafeEqualStrings } from './timing-safe';

export const DEFAULT_PBKDF2_ITERATIONS = 600000;
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

export async function verifyPasswordAndCheckUpgrade(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
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

  // 1. First test with standard 600,000 iterations (OWASP standard)
  const derivedKey600k = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: DEFAULT_PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const hashHex600k = Array.from(new Uint8Array(derivedKey600k))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (timingSafeEqualStrings(hashHex600k, originalHashHex)) {
    return { valid: true, needsUpgrade: false };
  }

  // 2. Fallback test with legacy 30,000 iterations
  const derivedKey30k = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 30000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const hashHex30k = Array.from(new Uint8Array(derivedKey30k))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (timingSafeEqualStrings(hashHex30k, originalHashHex)) {
    return { valid: true, needsUpgrade: true };
  }

  // 3. Fallback test with legacy 100,000 iterations
  const derivedKey100k = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const hashHex100k = Array.from(new Uint8Array(derivedKey100k))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (timingSafeEqualStrings(hashHex100k, originalHashHex)) {
    return { valid: true, needsUpgrade: true };
  }

  return { valid: false, needsUpgrade: false };
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const { valid } = await verifyPasswordAndCheckUpgrade(password, storedHash);
  return valid;
}
