import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
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

const app = new Hono<{ Bindings: Env }>();

// Middlewares
app.use('*', logger());
app.use('*', securityHeaders());
// Helper for validating trusted CORS origins
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin or non-browser requests
  try {
    const url = new URL(origin);
    const host = url.hostname;
    // Allow local development and test environments
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true;
    // Allow Cloudflare Workers deployment domains
    if (host === 'ams.humanone.workers.dev' || host.endsWith('.workers.dev') || host.endsWith('.pages.dev')) return true;
    return false;
  } catch {
    return false;
  }
}

app.use(
  '*',
  cors({
    origin: (origin) => (isAllowedOrigin(origin) ? (origin || '*') : ''),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  })
);
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
    // If route is a client-side SPA route (non-API GET returning 404 or redirect), serve index.html
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
