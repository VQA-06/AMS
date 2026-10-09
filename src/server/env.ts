export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ASSETS?: Fetcher;
  ENVIRONMENT?: string;
  QR_ACTIVE_KID?: string;
  QR_KEY_K1?: string;
  QR_KEY_K2?: string;
  SESSION_SECRET?: string;
  APP_ISSUER?: string;
  APP_AUDIENCE?: string;
  APP_DOMAIN?: string;
  ALLOWED_ORIGINS?: string;
  TRUSTED_ISSUERS?: string;
  DEV_ADMIN_EMAIL?: string;
  ENABLE_GUEST_CONVERSION?: string;
  [key: string]: unknown;
}
