import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './env';
import { errorHandler } from './middleware/error-handler';
import { securityHeaders } from './middleware/security-headers';
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
app.use(
  '*',
  cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'cf-access-authenticated-user-email'],
    credentials: true,
  })
);

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
app.route('/api/events', eventsRoutes);
app.route('/api/qr', qrRoutes);
app.route('/api/scan', scanRoutes);
app.route('/api/attendances', attendanceRoutes);
app.route('/api/audit', auditRoutes);

// Fallback for static assets in production Cloudflare Workers
app.all('*', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('AMS (Attendance Management System) - Computer Community API Running', 200);
});

export default app;
