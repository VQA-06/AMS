import { describe, it, expect } from 'vitest';
import {
  adminCreateFromMemberSchema,
  adminUpdateSchema,
  qrLoginSchema,
} from '../src/shared/schemas/auth.schema';
import { generateQrToken, verifyQrToken } from '../src/server/crypto/qr-crypto';
import { hashPassword, verifyPassword } from '../src/server/crypto/password-crypto';

const TEST_BASE64_KEY = 'dGhpcy1pcy1hLTMyLWJ5dGUtZGV2LWtleS1mb3ItandlISE=';
const MOCK_ENV = {
  QR_ACTIVE_KID: 'k1',
  QR_KEY_K1: TEST_BASE64_KEY,
};
const ISSUER = 'https://absen.local';
const AUDIENCE = 'ams';

describe('Team Management & QR Login Schemas', () => {
  it('should validate valid member-linked admin creation input', () => {
    const parsed = adminCreateFromMemberSchema.parse({
      member_id: 'mem_abc123',
      role: 'admin',
      password: 'SecurePassword123!',
    });
    expect(parsed.member_id).toBe('mem_abc123');
    expect(parsed.role).toBe('admin');
    expect(parsed.password).toBe('SecurePassword123!');
  });

  it('should reject member-linked admin creation with short password', () => {
    expect(() =>
      adminCreateFromMemberSchema.parse({
        member_id: 'mem_abc123',
        role: 'operator',
        password: '123',
      })
    ).toThrow();
  });

  it('should validate admin update input', () => {
    const parsed = adminUpdateSchema.parse({
      role: 'owner',
      status: 'inactive',
      password: 'NewPassword123!',
    });
    expect(parsed.role).toBe('owner');
    expect(parsed.status).toBe('inactive');
    expect(parsed.password).toBe('NewPassword123!');
  });

  it('should validate QR login token input', () => {
    const parsed = qrLoginSchema.parse({
      qr: 'eyJhbGciOiJBMjU2R0NNS1ciLCJlbmMiOiJBMjU2R0NNIn0.valid.token.here',
    });
    expect(parsed.qr).toContain('eyJhbGci');
  });

  it('should generate a member universal QR token and decrypt it for QR authentication', async () => {
    const memberId = 'mem_team_member_456';
    const jti = 'jti_auth_token_789';
    const validFrom = new Date(Date.now() - 1000);
    const expiresAt = new Date(Date.now() + 86400000);

    const token = await generateQrToken(
      {
        memberId,
        jti,
        scope: 'universal',
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

    expect(decrypted.memberId).toBe(memberId);
    expect(decrypted.scope).toBe('universal');
    expect(decrypted.eventId).toBeNull();
  });

  it('should properly hash and verify initial passwords for newly created team members', async () => {
    const initialPass = 'PanitiaSuper2026!';
    const hash = await hashPassword(initialPass);

    expect(await verifyPassword(initialPass, hash)).toBe(true);
    expect(await verifyPassword('WrongPassword!', hash)).toBe(false);
  });
});
