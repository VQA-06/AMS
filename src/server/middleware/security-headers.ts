import { Context, Next } from 'hono';

/**
 * Enterprise-Grade Security Headers Middleware (OWASP Secure Headers Project)
 * Adds protection against:
 * - MIME type sniffing (X-Content-Type-Options: nosniff)
 * - Clickjacking (X-Frame-Options: DENY)
 * - Cross-site scripting (X-XSS-Protection: 1; mode=block)
 * - Referrer leakage (Referrer-Policy: strict-origin-when-cross-origin)
 * - Restrict unauthorized hardware access (Permissions-Policy: camera=(self))
 */
export function securityHeaders() {
  return async (c: Context, next: Next) => {
    await next();

    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(self), geolocation=(), microphone=()');
  };
}
