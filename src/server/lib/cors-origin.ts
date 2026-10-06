import { Env } from '../env';

export const STANDARD_DEV_PORTS = new Set(['5173', '8787', '5175', '4173', '3000']);

/**
 * Helper for validating trusted CORS origins dynamically.
 * Restricts arbitrary unconfigured loopback ports while allowing standard local dev tooling
 * and explicitly configured ALLOWED_ORIGINS.
 */
export function isAllowedOrigin(origin: string | undefined, env?: Partial<Env>): boolean {
  if (!origin) return true; // same-origin or non-browser requests
  try {
    const url = new URL(origin);
    const host = url.hostname;
    const port = url.port;

    // Check dynamically configured ALLOWED_ORIGINS from env
    if (env?.ALLOWED_ORIGINS) {
      const allowedList = env.ALLOWED_ORIGINS.split(',').map((item) => item.trim());
      for (const allowed of allowedList) {
        try {
          const allowedUrl = new URL(allowed);
          if (allowedUrl.origin === url.origin || allowedUrl.hostname === host) return true;
        } catch {
          if (allowed === host || allowed === origin) return true;
        }
      }
    }

    // Strict local development validation (restricts arbitrary unconfigured loopback ports)
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
      if (!port || STANDARD_DEV_PORTS.has(port)) {
        return true;
      }
      return false;
    }

    // Check APP_DOMAIN or APP_ISSUER from env
    if (env?.APP_DOMAIN && (host === env.APP_DOMAIN || host.endsWith(`.${env.APP_DOMAIN}`))) return true;
    if (env?.APP_ISSUER) {
      try {
        if (new URL(env.APP_ISSUER).hostname === host) return true;
      } catch {
        // Ignore malformed issuer URL
      }
    }

    // Default trusted official domains
    if (
      host === 'ams.ccunbaja.web.id' ||
      host.endsWith('.ccunbaja.web.id') ||
      host === 'ams.humanone.workers.dev'
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
