import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  verifyPasswordAndCheckUpgrade,
  DEFAULT_PBKDF2_ITERATIONS,
} from '../src/server/crypto/password-crypto';

describe('Password Cryptography (PBKDF2 Web Crypto)', () => {
  it('should use 100,000 iterations aligned with Cloudflare Workers platform limit', () => {
    expect(DEFAULT_PBKDF2_ITERATIONS).toBe(100000);
  });

  it('should hash a password and generate salt:hash format', async () => {
    const password = 'Owner123!';
    const hash = await hashPassword(password);

    expect(hash).toContain(':');
    const [salt, key] = hash.split(':');
    expect(salt).toHaveLength(32); // 16 bytes hex
    expect(key).toHaveLength(64); // 32 bytes hex
  });

  it('should verify correct password successfully', async () => {
    const password = 'SecurePassword456!';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'CorrectPassword123!';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword('WrongPassword!', hash);
    expect(isValid).toBe(false);
  });

  it('should produce unique salts for the same password', async () => {
    const password = 'SamePassword123!';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });

  it('should verify standard 100k hash without needing upgrade', async () => {
    const password = 'Standard100kPassword!';
    const hash = await hashPassword(password);

    const { valid, needsUpgrade } = await verifyPasswordAndCheckUpgrade(password, hash);
    expect(valid).toBe(true);
    expect(needsUpgrade).toBe(false);
  });

  it('should verify legacy 30k hash and mark for upgrade', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('Legacy30kPassword!'),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const derivedKey = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 30000, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
    const hashHex = Array.from(new Uint8Array(derivedKey)).map((b) => b.toString(16).padStart(2, '0')).join('');
    const legacyHash = `${saltHex}:${hashHex}`;

    const { valid, needsUpgrade } = await verifyPasswordAndCheckUpgrade('Legacy30kPassword!', legacyHash);
    expect(valid).toBe(true);
    expect(needsUpgrade).toBe(true);
  });

  it('should safely handle malformed or invalid hash formats', async () => {
    expect(await verifyPassword('any', '')).toBe(false);
    expect(await verifyPassword('any', 'invalid-hash')).toBe(false);
    expect(await verifyPassword('any', 'nothex:nothex')).toBe(false);
    expect(await verifyPassword('any', '00:00')).toBe(false);

    const { valid, needsUpgrade } = await verifyPasswordAndCheckUpgrade('any', 'invalid');
    expect(valid).toBe(false);
    expect(needsUpgrade).toBe(false);
  });
});
