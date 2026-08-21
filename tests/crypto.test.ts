import { describe, it, expect } from 'vitest';
import { generateQrToken, verifyQrToken, getCryptoKeyFromBase64 } from '../src/server/crypto/qr-crypto';
import { ErrorCode } from '../src/shared/constants/error-codes';

const TEST_BASE64_KEY = 'dGhpcy1pcy1hLTMyLWJ5dGUtZGV2LWtleS1mb3ItandlISE='; // 32-byte key
const MOCK_ENV = {
  QR_ACTIVE_KID: 'k1',
  QR_KEY_K1: TEST_BASE64_KEY,
};

const ISSUER = 'https://absen.test';
const AUDIENCE = 'ams';

describe('QR Cryptography & JWE Token Service', () => {
  it('should successfully encrypt and decrypt a universal QR token', async () => {
    const validFrom = new Date(Date.now() - 10000);
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour later

    const token = await generateQrToken(
      {
        memberId: 'mem_123',
        jti: 'jti_abc',
        scope: 'universal',
        validFrom,
        expiresAt,
        issuer: ISSUER,
        audience: AUDIENCE,
        kid: 'k1',
      },
      MOCK_ENV
    );

    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(5);

    const decrypted = await verifyQrToken(token, {
      expectedIssuer: ISSUER,
      expectedAudience: AUDIENCE,
      env: MOCK_ENV,
    });

    expect(decrypted.memberId).toBe('mem_123');
    expect(decrypted.jti).toBe('jti_abc');
    expect(decrypted.scope).toBe('universal');
    expect(decrypted.eventId).toBeNull();
    expect(decrypted.kid).toBe('k1');
  });

  it('should successfully encrypt and decrypt an event-specific QR token', async () => {
    const validFrom = new Date(Date.now() - 10000);
    const expiresAt = new Date(Date.now() + 3600000);

    const token = await generateQrToken(
      {
        memberId: 'mem_456',
        jti: 'jti_xyz',
        scope: 'event',
        eventId: 'evt_789',
        validFrom,
        expiresAt,
        issuer: ISSUER,
        audience: AUDIENCE,
        kid: 'k1',
      },
      MOCK_ENV
    );

    const decrypted = await verifyQrToken(token, {
      expectedIssuer: ISSUER,
      expectedAudience: AUDIENCE,
      env: MOCK_ENV,
    });

    expect(decrypted.memberId).toBe('mem_456');
    expect(decrypted.jti).toBe('jti_xyz');
    expect(decrypted.scope).toBe('event');
    expect(decrypted.eventId).toBe('evt_789');
  });

  it('should reject expired tokens with TOKEN_EXPIRED error', async () => {
    const validFrom = new Date(Date.now() - 7200000); // 2 hours ago
    const expiresAt = new Date(Date.now() - 3600000); // 1 hour ago

    const token = await generateQrToken(
      {
        memberId: 'mem_expired',
        jti: 'jti_exp',
        scope: 'universal',
        validFrom,
        expiresAt,
        issuer: ISSUER,
        audience: AUDIENCE,
        kid: 'k1',
      },
      MOCK_ENV
    );

    await expect(
      verifyQrToken(token, {
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        env: MOCK_ENV,
      })
    ).rejects.toThrow(ErrorCode.TOKEN_EXPIRED);
  });

  it('should reject future tokens with TOKEN_NOT_ACTIVE_YET error', async () => {
    const validFrom = new Date(Date.now() + 3600000); // 1 hour in the future
    const expiresAt = new Date(Date.now() + 7200000); // 2 hours in the future

    const token = await generateQrToken(
      {
        memberId: 'mem_future',
        jti: 'jti_fut',
        scope: 'universal',
        validFrom,
        expiresAt,
        issuer: ISSUER,
        audience: AUDIENCE,
        kid: 'k1',
      },
      MOCK_ENV
    );

    await expect(
      verifyQrToken(token, {
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        env: MOCK_ENV,
      })
    ).rejects.toThrow(ErrorCode.TOKEN_NOT_ACTIVE_YET);
  });

  it('should reject tokens with wrong audience', async () => {
    const validFrom = new Date(Date.now() - 10000);
    const expiresAt = new Date(Date.now() + 3600000);

    const token = await generateQrToken(
      {
        memberId: 'mem_test',
        jti: 'jti_test',
        scope: 'universal',
        validFrom,
        expiresAt,
        issuer: ISSUER,
        audience: 'wrong-audience',
        kid: 'k1',
      },
      MOCK_ENV
    );

    await expect(
      verifyQrToken(token, {
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        env: MOCK_ENV,
      })
    ).rejects.toThrow();
  });
});
