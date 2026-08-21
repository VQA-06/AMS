import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/server/crypto/password-crypto';

describe('Password Cryptography (PBKDF2 Web Crypto)', () => {
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
});
