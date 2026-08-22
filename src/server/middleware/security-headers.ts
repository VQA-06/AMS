import { Context, Next } from 'hono';

/**
 * Enterprise-Grade Security Headers Middleware (OWASP Secure Headers Project)
 * Adds comprehensive defense-in-depth protection against:
 * - Cross-Site Scripting (Content-Security-Policy & X-XSS-Protection)
 * - SSL Stripping / Protocol Downgrade (Strict-Transport-Security)
 * - MIME type sniffing (X-Content-Type-Options: nosniff)
 * - Clickjacking (X-Frame-Options: DENY & frame-ancestors 'none')
 * - Cross-Origin Leaks (Cross-Origin-Opener-Policy & Cross-Origin-Resource-Policy)
 * - Referrer leakage (Referrer-Policy: strict-origin-when-cross-origin)
 * - Unauthorized hardware/sensor access (Permissions-Policy)
 */
export function securityHeaders() {
  const cspPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  return async (c: Context, next: Next) => {
    await next();

    c.header('Content-Security-Policy', cspPolicy);
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Cross-Origin-Opener-Policy', 'same-origin');
    c.header('Cross-Origin-Resource-Policy', 'same-origin');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(self), geolocation=(), microphone=()');
  };
}
