import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { getCookie } from 'hono/cookie';
import { Env } from './env';
import { errorHandler } from './middleware/error-handler';
import { securityHeaders } from './middleware/security-headers';
import { etagMiddleware } from './middleware/etag';
import { authRoutes } from './routes/auth.routes';
import { membersRoutes } from './routes/members.routes';
import { eventsRoutes } from './routes/events.routes';
import { qrRoutes } from './routes/qr.routes';
import { scanRoutes } from './routes/scan.routes';
import { attendanceRoutes } from './routes/attendance.routes';
import { auditRoutes } from './routes/audit.routes';
import { ApiResponse } from '@/shared/types';
import { ErrorCode } from '@/shared/constants/error-codes';

const app = new Hono<{ Bindings: Env }>();

// Middlewares
app.use('*', logger());
app.use('*', securityHeaders());
import { isAllowedOrigin } from './lib/cors-origin';
export { isAllowedOrigin } from './lib/cors-origin';

app.use('*', async (c, next) => {
  const originHeader = c.req.header('origin');
  const allowed = isAllowedOrigin(originHeader, c.env);
  const corsMiddleware = cors({
    origin: (origin) => (allowed && origin ? origin : ''),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: allowed,
    maxAge: 86400,
  });
  return corsMiddleware(c, next);
});

// Server-Side CSRF Defense for Cookie-Authenticated Mutating Requests
app.use('/api/*', async (c, next) => {
  const method = c.req.method.toUpperCase();
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (isMutating) {
    const authHeader = c.req.header('authorization');
    const cookieSession = getCookie(c, 'absen_session');

    // If request authenticates via ambient cookie and does not use explicit Authorization header
    if (cookieSession && !authHeader) {
      const origin = c.req.header('origin');
      const referer = c.req.header('referer');

      let callerOrigin: string | undefined = origin;
      if (!callerOrigin && referer) {
        try {
          callerOrigin = new URL(referer).origin;
        } catch {
          // ignore malformed referer
        }
      }

      if (!callerOrigin || !isAllowedOrigin(callerOrigin, c.env)) {
        return c.json<ApiResponse>(
          {
            ok: false,
            error: {
              code: ErrorCode.FORBIDDEN,
              message: 'Permintaan lintas asal (CSRF) ditolak.',
            },
          },
          403
        );
      }
    }
  }

  return next();
});

app.use('/api/*', etagMiddleware());

// Global Error Handler
app.onError(errorHandler);

// API Health Check
app.get('/api/health', (c) => {
  return c.json({
    ok: true,
    data: {
      status: 'healthy',
      app: 'AMS (Attendance Management System)',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'development',
    },
  });
});

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/members', membersRoutes);
// Enterprise multi-browser & adblock-immune routes (Brave Shields, uBlock, EasyPrivacy safe)
app.route('/api/agenda', eventsRoutes);
app.route('/api/programs', eventsRoutes);
app.route('/api/activities', eventsRoutes);
app.route('/api/events', eventsRoutes); // Backward-compatible alias
app.route('/api/qr', qrRoutes);
app.route('/api/scan', scanRoutes);
app.route('/api/attendances', attendanceRoutes);
app.route('/api/audit', auditRoutes);

// Fallback for static assets and Single Page Application (SPA) HTML5 History routing
app.all('*', async (c) => {
  // If request is targeting an API route that does not exist, return JSON 404
  if (c.req.path.startsWith('/api')) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'API endpoint tidak ditemukan.',
        },
      },
      404
    );
  }

  if (c.env.ASSETS) {
    const response = await c.env.ASSETS.fetch(c.req.raw);

    // 1. Service Worker: Must NEVER be cached with long TTL on Cloudflare CDN
    if (c.req.path === '/sw.js') {
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
      headers.set('Content-Type', 'text/javascript');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // 2. Web App Manifest MIME type
    if (c.req.path === '/manifest.webmanifest') {
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/manifest+json');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // 3. If route is a client-side SPA route (non-API GET returning 404 or redirect), serve index.html
    if (
      c.req.method === 'GET' &&
      (response.status === 404 || response.status === 301 || response.status === 302)
    ) {
      const url = new URL(c.req.url);
      url.pathname = '/index.html';
      return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
    }
    return response;
  }
  return c.text('AMS (Attendance Management System) - Computer Community API Running', 200);
});

export default app;
