import { ApiResponse } from '@/shared/types';

export class ApiError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

export interface FetchApiOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

/**
 * Enterprise-Grade Resilient HTTP Client
 * - Automatic 15s timeout with AbortController
 * - Automatic retry with exponential backoff on transient network drops for GET requests
 * - Clear Indonesian network error descriptions
 */
export async function fetchApi<T = unknown>(
  url: string,
  options: FetchApiOptions = {}
): Promise<T> {
  const { timeoutMs = 15000, retries = (options.method && options.method !== 'GET' ? 0 : 1), ...fetchOptions } = options;
  const isGet = !fetchOptions.method || fetchOptions.method.toUpperCase() === 'GET';

  let attempt = 0;
  const maxAttempts = isGet ? Math.max(1, retries + 1) : 1;

  while (attempt < maxAttempts) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // If external signal is provided, forward its abort
    if (fetchOptions.signal) {
      fetchOptions.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const headers = new Headers(fetchOptions.headers || {});
      if (!headers.has('Content-Type') && !(fetchOptions.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
      }

      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('ams_session_token');
        if (token && !headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      }

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/csv')) {
        const text = await response.text();
        return text as unknown as T;
      }

      let json: ApiResponse<T>;
      try {
        json = await response.json();
      } catch {
        throw new ApiError('Gagal memproses respons dari server.', 'NETWORK_ERROR');
      }

      if (!json.ok || !response.ok) {
        const err = json.error || { message: 'Terjadi kesalahan sistem', code: 'UNKNOWN_ERROR' };
        throw new ApiError(err.message, err.code, err.details);
      }

      return json.data as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof ApiError) {
        throw err;
      }

      const isAbort = err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));
      const isNetworkFail =
        err instanceof Error &&
        (err.name === 'TypeError' ||
          err.message.includes('fetch') ||
          err.message.includes('Failed to fetch') ||
          err.message.includes('NetworkError'));

      // If we have retries left for idempotent requests, backoff and retry
      if (attempt < maxAttempts && (isAbort || isNetworkFail)) {
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
        continue;
      }

      if (isAbort) {
        throw new ApiError(
          'Batas waktu permintaan habis (15 detik). Jaringan Anda mungkin lambat atau server sedang sibuk.',
          'NETWORK_TIMEOUT'
        );
      }

      if (isNetworkFail || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new ApiError(
          'Koneksi internet terputus. Silakan periksa jaringan Wi-Fi atau data seluler Anda.',
          'NETWORK_OFFLINE'
        );
      }

      throw new ApiError(
        err instanceof Error ? err.message : 'Terjadi gangguan jaringan atau server.',
        'NETWORK_ERROR'
      );
    }
  }

  throw new ApiError('Gagal menghubungi server setelah beberapa percobaan.', 'NETWORK_ERROR');
}
