import { EncryptJWT, jwtDecrypt } from 'jose';
import { ErrorCode } from '@/shared/constants/error-codes';

export interface QrTokenPayload {
  memberId: string;
  jti: string;
  scope: 'universal' | 'event';
  eventId?: string | null;
  validFrom: Date | string;
  expiresAt: Date | string;
  issuer: string;
  audience: string;
  kid: string;
}

export interface DecryptedQrToken {
  jti: string;
  memberId: string;
  scope: 'universal' | 'event';
  eventId: string | null;
  validFrom: Date;
  expiresAt: Date;
  issuer: string;
  audience: string;
  kid: string;
}

/**
 * Convert base64 key string or raw string to WebCrypto CryptoKey (AES-GCM 256-bit)
 */
export async function getCryptoKeyFromBase64(base64Key: string): Promise<CryptoKey> {
  if (!base64Key) {
    throw new Error(ErrorCode.UNKNOWN_KEY);
  }

  let bytes: Uint8Array;
  try {
    const binaryString = atob(base64Key.trim());
    bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
  } catch {
    bytes = new TextEncoder().encode(base64Key);
  }

  // Ensure exact 32 bytes (256 bits) for AES-256-GCM
  if (bytes.length !== 32) {
    if (bytes.length > 32) {
      bytes = bytes.slice(0, 32);
    } else {
      const padded = new Uint8Array(32);
      padded.set(bytes);
      bytes = padded;
    }
  }

  const rawBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;

  return crypto.subtle.importKey(
    'raw',
    rawBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Key resolver by Key ID (kid) from Environment bindings
 */
export async function getKeyByKid(kid: string, env: Record<string, unknown>): Promise<CryptoKey> {
  const envKey = `QR_KEY_${kid.toUpperCase()}`;
  const secretBase64 = env[envKey] as string | undefined;

  if (!secretBase64) {
    if (kid.toLowerCase() === 'k1' && typeof env.QR_KEY_K1 === 'string') {
      return getCryptoKeyFromBase64(env.QR_KEY_K1);
    }
    throw new Error(ErrorCode.UNKNOWN_KEY);
  }

  return getCryptoKeyFromBase64(secretBase64);
}

/**
 * Generate encrypted JWE Compact Token
 */
export async function generateQrToken(
  input: QrTokenPayload,
  keyOrEnv: CryptoKey | Record<string, unknown>
): Promise<string> {
  const key =
    keyOrEnv instanceof CryptoKey
      ? keyOrEnv
      : await getKeyByKid(input.kid, keyOrEnv);

  const nbfDate = new Date(input.validFrom);
  const expDate = new Date(input.expiresAt);

  const jwt = await new EncryptJWT({
    scope: input.scope,
    eventId: input.scope === 'event' ? input.eventId ?? null : null,
  })
    .setProtectedHeader({
      alg: 'dir',
      enc: 'A256GCM',
      typ: 'AQ1',
      kid: input.kid,
    })
    .setIssuer(input.issuer)
    .setAudience(input.audience)
    .setSubject(input.memberId)
    .setJti(input.jti)
    .setIssuedAt(Math.floor(nbfDate.getTime() / 1000))
    .setNotBefore(Math.floor(nbfDate.getTime() / 1000))
    .setExpirationTime(Math.floor(expDate.getTime() / 1000))
    .encrypt(key);

  return jwt;
}

/**
 * Decrypt and verify JWE Compact Token with claims validation
 */
export async function verifyQrToken(
  token: string,
  options: {
    expectedIssuer: string;
    expectedAudience: string;
    env: Record<string, unknown>;
  }
): Promise<DecryptedQrToken> {
  if (!token || typeof token !== 'string') {
    throw new Error(ErrorCode.TOKEN_INVALID);
  }

  const parts = token.trim().split('.');
  if (parts.length !== 5) {
    throw new Error(ErrorCode.TOKEN_INVALID);
  }

  // Parse unencrypted header to get kid
  let header: { alg?: string; enc?: string; typ?: string; kid?: string };
  try {
    const rawHeader = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
    header = JSON.parse(rawHeader);
  } catch {
    throw new Error(ErrorCode.TOKEN_INVALID);
  }

  if (header.alg !== 'dir' || header.enc !== 'A256GCM') {
    throw new Error(ErrorCode.TOKEN_INVALID);
  }

  const kid = header.kid || (options.env.QR_ACTIVE_KID as string) || 'k1';
  let key: CryptoKey;
  try {
    key = await getKeyByKid(kid, options.env);
  } catch {
    throw new Error(ErrorCode.UNKNOWN_KEY);
  }

  try {
    const { payload, protectedHeader } = await jwtDecrypt(token, key, {
      issuer: options.expectedIssuer,
      audience: options.expectedAudience,
    });

    const now = Math.floor(Date.now() / 1000);

    if (payload.nbf && payload.nbf > now) {
      throw new Error(ErrorCode.TOKEN_NOT_ACTIVE_YET);
    }

    if (payload.exp && payload.exp <= now) {
      throw new Error(ErrorCode.TOKEN_EXPIRED);
    }

    const scope = payload.scope as 'universal' | 'event';
    if (scope !== 'universal' && scope !== 'event') {
      throw new Error(ErrorCode.TOKEN_INVALID);
    }

    const eventId = (payload.eventId as string | null) || null;
    if (scope === 'event' && !eventId) {
      throw new Error(ErrorCode.TOKEN_INVALID);
    }

    return {
      jti: payload.jti as string,
      memberId: payload.sub as string,
      scope,
      eventId,
      validFrom: new Date((payload.nbf || payload.iat || 0) * 1000),
      expiresAt: new Date((payload.exp || 0) * 1000),
      issuer: payload.iss as string,
      audience: typeof payload.aud === 'string' ? payload.aud : payload.aud?.[0] || '',
      kid: (protectedHeader.kid as string) || kid,
    };
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message in ErrorCode) {
        throw err;
      }
      const anyErr = err as { claim?: string; code?: string; name?: string; message: string };
      if (anyErr.claim === 'nbf' || anyErr.message.includes('before "nbf"') || anyErr.message.includes('not active')) {
        throw new Error(ErrorCode.TOKEN_NOT_ACTIVE_YET);
      }
      if (anyErr.claim === 'exp' || anyErr.name === 'JWTExpired' || anyErr.message.includes('expired')) {
        throw new Error(ErrorCode.TOKEN_EXPIRED);
      }
      if (anyErr.claim === 'aud' || anyErr.message.includes('audience') || anyErr.message.includes('unexpected "aud"')) {
        throw new Error(ErrorCode.WRONG_AUDIENCE);
      }
      if (anyErr.claim === 'iss' || anyErr.message.includes('issuer') || anyErr.message.includes('unexpected "iss"')) {
        throw new Error(ErrorCode.WRONG_ISSUER);
      }
    }
    throw new Error(ErrorCode.TOKEN_INVALID);
  }
}
