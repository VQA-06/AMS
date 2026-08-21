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
 * - Automatic 30s timeout with AbortController for mobile resilience
 * - Automatic retry with exponential backoff on transient network drops for GET requests
 * - Clear, transparent error descriptions
 */
export async function fetchApi<T = unknown>(
  url: string,
  options: FetchApiOptions = {}
): Promise<T> {
  const { timeoutMs = 30000, retries = (options.method && options.method !== 'GET' ? 0 : 1), ...fetchOptions } = options;
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

      let json: ApiResponse<T> | null = null;
      let rawText = '';
      try {
        json = await response.json();
      } catch {
        try {
          rawText = await response.text();
        } catch {
          // ignore
        }
      }

      if (!response.ok || !json?.ok) {
        if (json?.error?.message) {
          throw new ApiError(json.error.message, json.error.code || 'API_ERROR', json.error.details);
        }

        if (response.status === 401) {
          throw new ApiError('Sesi login telah berakhir. Silakan login kembali.', 'UNAUTHORIZED');
        }

        if (response.status === 403) {
          throw new ApiError('Anda tidak memiliki hak akses untuk aksi ini.', 'FORBIDDEN');
        }

        if (response.status === 404) {
          throw new ApiError('Data atau endpoint tidak ditemukan (404).', 'NOT_FOUND');
        }

        if (response.status >= 500) {
          throw new ApiError(
            `Terjadi gangguan pada server backend (${response.status}: ${response.statusText || 'Internal Error'}).`,
            'SERVER_ERROR'
          );
        }

        throw new ApiError(
          rawText || `Permintaan gagal dengan status ${response.status} (${response.statusText || 'Error'}).`,
          'REQUEST_ERROR'
        );
      }

      return (json.data ?? json) as T;
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
          'Batas waktu permintaan habis (30 detik). Jaringan Anda mungkin lambat atau server sedang sibuk.',
          'NETWORK_TIMEOUT'
        );
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new ApiError(
          'Koneksi internet terputus. Silakan periksa jaringan Wi-Fi atau data seluler Anda.',
          'NETWORK_OFFLINE'
        );
      }

      if (isNetworkFail) {
        throw new ApiError(
          'Gagal terhubung ke server. Periksa stabilitas koneksi internet Anda atau coba sesaat lagi.',
          'NETWORK_ERROR'
        );
      }

      throw new ApiError(
        err instanceof Error ? err.message : 'Terjadi gangguan jaringan atau server.',
        'UNKNOWN_ERROR'
      );
    }
  }

  throw new ApiError('Gagal menghubungi server setelah beberapa percobaan.', 'NETWORK_ERROR');
}
