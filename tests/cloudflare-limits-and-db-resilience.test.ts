import { describe, it, expect, vi } from 'vitest';
import { createSessionToken, verifySessionToken } from '../src/server/crypto/session-crypto';
import { chunkArray, D1_MAX_SAFE_PARAM_CHUNK } from '../src/server/lib/d1-utils';
import { MemberRepository } from '../src/server/repositories/member.repo';
import { hashPassword, verifyPassword } from '../src/server/crypto/password-crypto';

describe('Cloudflare Limits & Database Resilience Tests', () => {
  describe('Stateless Cryptographic Session Tokens (session-crypto)', () => {
    const secret = 'super-secret-key-for-testing-32-chars-long';

    it('should create and verify a valid HMAC-SHA256 session token', async () => {
      const token = await createSessionToken(
        { email: 'admin@ams.cc', role: 'owner' },
        secret,
        3600
      );

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(2);

      const verified = await verifySessionToken(token, secret);
      expect(verified).not.toBeNull();
      expect(verified?.email).toBe('admin@ams.cc');
      expect(verified?.role).toBe('owner');
      expect(verified?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should reject a tampered session token', async () => {
      const token = await createSessionToken(
        { email: 'admin@ams.cc', role: 'owner' },
        secret,
        3600
      );

      const [payloadB64, sigB64] = token.split('.');
      // Tamper with payload
      const tamperedPayload = payloadB64.slice(0, -2) + 'aa';
      const tamperedToken = `${tamperedPayload}.${sigB64}`;

      const verified = await verifySessionToken(tamperedToken, secret);
      expect(verified).toBeNull();
    });

    it('should reject an expired session token', async () => {
      // Expire immediately (ttl = -10 seconds)
      const token = await createSessionToken(
        { email: 'admin@ams.cc', role: 'owner' },
        secret,
        -10
      );

      const verified = await verifySessionToken(token, secret);
      expect(verified).toBeNull();
    });

    it('should reject token signed with a different secret', async () => {
      const token = await createSessionToken(
        { email: 'admin@ams.cc', role: 'owner' },
        'secret-one-that-is-different-1234567890',
        3600
      );

      const verified = await verifySessionToken(token, 'secret-two-that-is-different-1234567890');
      expect(verified).toBeNull();
    });
  });

  describe('D1 Safe Parameter Chunking (d1-utils)', () => {
    it('should chunk array into slices of max 50 items', () => {
      const items = Array.from({ length: 125 }, (_, i) => `item-${i}`);
      const chunks = chunkArray(items, 50);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(50);
      expect(chunks[1]).toHaveLength(50);
      expect(chunks[2]).toHaveLength(25);
      expect(D1_MAX_SAFE_PARAM_CHUNK).toBe(50);
      expect(D1_MAX_SAFE_PARAM_CHUNK).toBeLessThan(100);
    });

    it('should handle empty or small arrays safely', () => {
      expect(chunkArray([])).toEqual([]);
      expect(chunkArray(['a', 'b'])).toEqual([['a', 'b']]);
    });
  });

  describe('MemberRepository findByIds with D1 Chunking', () => {
    it('should query in batches and combine results without exceeding 100 params', async () => {
      const ids = Array.from({ length: 110 }, (_, i) => `mem_${i}`);

      const mockDb = {
        prepare: vi.fn().mockImplementation((query: string) => {
          return {
            bind: vi.fn().mockImplementation((...params: string[]) => {
              // Ensure no single query binds more than 50 parameters
              expect(params.length).toBeLessThanOrEqual(50);
              return {
                all: vi.fn().mockResolvedValue({
                  results: params.map((id) => ({ id, name: `Member ${id}` })),
                }),
              };
            }),
          };
        }),
      } as any;

      const repo = new MemberRepository(mockDb);
      const members = await repo.findByIds(ids);

      expect(mockDb.prepare).toHaveBeenCalledTimes(3); // 50 + 50 + 10 = 3 queries
      expect(members).toHaveLength(110);
    });
  });

  describe('Password Hashing CPU Optimization & Compatibility', () => {
    it('should hash with 30k iterations and verify successfully', async () => {
      const password = 'mySecretSecurePassword123!';
      const hash = await hashPassword(password);

      expect(hash).toContain(':');
      const isMatch = await verifyPassword(password, hash);
      expect(isMatch).toBe(true);

      const isWrong = await verifyPassword('wrong-password', hash);
      expect(isWrong).toBe(false);
    });
  });
});
