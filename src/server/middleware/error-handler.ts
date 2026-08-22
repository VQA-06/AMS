import { Context } from 'hono';
import { ZodError } from 'zod';
import { ErrorCode } from '@/shared/constants/error-codes';
import { ApiResponse } from '@/shared/types';

export function errorHandler(err: Error, c: Context) {
  console.error('API Error:', err);

  if (err instanceof ZodError) {
    const errorDetails = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: err.errors[0]?.message || 'Input validation failed',
          details: errorDetails,
        },
      },
      400
    );
  }

  const isKnownErrorCode = (Object.values(ErrorCode) as string[]).includes(err.message);
  const code = isKnownErrorCode ? err.message : ErrorCode.INTERNAL_ERROR;

  const status =
    code === ErrorCode.UNAUTHORIZED
      ? 401
      : code === ErrorCode.FORBIDDEN
      ? 403
      : code === ErrorCode.NOT_FOUND ||
        code === ErrorCode.MEMBER_NOT_FOUND ||
        code === ErrorCode.EVENT_NOT_FOUND
      ? 404
      : code === ErrorCode.RATE_LIMITED
      ? 429
      : code === ErrorCode.INTERNAL_ERROR
      ? 500
      : 400;

  // Never leak internal database query errors, table names, or raw exception traces in production
  let responseMessage = err.message || 'Internal server error';
  if (status === 500) {
    const isDev = (c.env as any)?.ENVIRONMENT === 'development';
    responseMessage = isDev && err.message
      ? err.message
      : 'Terjadi gangguan pada server backend. Silakan coba beberapa saat lagi.';
  }

  return c.json<ApiResponse>(
    {
      ok: false,
      error: {
        code,
        message: responseMessage,
      },
    },
    status as any
  );
}
