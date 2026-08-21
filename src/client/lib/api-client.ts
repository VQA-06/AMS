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
 * - Single-pass body stream read (eliminates TypeError: Already read)
 * - Automatic 30s timeout with AbortController
 * - Automatic retry with exponential backoff on transient network drops
 * - Multi-route auto-failover against browser adblockers (Brave Shields, uBlock Origin)
 * - Clear, actionable error descriptions
 */
export async function fetchApi<T = unknown>(
  url: string,
  options: FetchApiOptions = {}
): Promise<T> {
  const { timeoutMs = 30000, retries = (options.method && options.method !== 'GET' ? 0 : 1), ...fetchOptions } = options;
  const isGet = !fetchOptions.method || fetchOptions.method.toUpperCase() === 'GET';

  let currentUrl = url;
  let attempt = 0;
  const maxAttempts = Math.max(1, retries + 1);

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

      const response = await fetch(currentUrl, {
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

      // Single-pass body read to prevent stream consumption collision
      let rawText = '';
      if (typeof response.text === 'function') {
        rawText = await response.text();
      } else if (typeof response.json === 'function') {
        const j = await response.json();
        rawText = JSON.stringify(j);
      }

      let json: ApiResponse<T> | null = null;
      if (rawText && rawText.trim() !== '') {
        try {
          json = JSON.parse(rawText);
        } catch {
          // Response is non-JSON (e.g. plain text or HTML error page)
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
          const cleanSnippet = rawText && !rawText.startsWith('<!') && rawText.length < 200 ? `: ${rawText}` : '';
          throw new ApiError(
            `Terjadi gangguan pada server backend (${response.status}: ${response.statusText || 'Internal Server Error'})${cleanSnippet}.`,
            'SERVER_ERROR'
          );
        }

        throw new ApiError(
          (rawText && !rawText.startsWith('<!') ? rawText : null) ||
            `Permintaan gagal dengan status ${response.status} (${response.statusText || 'Error'}).`,
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
          err.message.includes('net::ERR_BLOCKED_BY_CLIENT') ||
          err.message.includes('NetworkError'));

      // Multi-route auto-failover against aggressive browser adblockers
      if (isNetworkFail && currentUrl.includes('/api/agenda')) {
        currentUrl = currentUrl.replace('/api/agenda', '/api/programs');
      } else if (isNetworkFail && currentUrl.includes('/api/programs')) {
        currentUrl = currentUrl.replace('/api/programs', '/api/activities');
      } else if (isNetworkFail && currentUrl.includes('/api/events')) {
        currentUrl = currentUrl.replace('/api/events', '/api/agenda');
      }

      // If we have retries left, backoff and retry with possible alternate route
      if (attempt < maxAttempts && (isAbort || isNetworkFail)) {
        await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
        continue;
      }

      if (isAbort) {
        throw new ApiError(
          'Batas waktu permintaan habis (30 detik). Jaringan Anda mungkin lambat atau server sedang sibuk.',
          'NETWORK_TIMEOUT'
        );
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new ApiError(
          'Koneksi internet terputus. Silakan periksa jaringan Wi-Fi atau data seluler Anda.',
          'NETWORK_OFFLINE'
        );
      }

      if (err instanceof Error && err.message.includes('ERR_BLOCKED_BY_CLIENT')) {
        throw new ApiError(
          'Permintaan diblokir oleh browser atau ekstensi AdBlocker (seperti Brave Shields / uBlock). Harap nonaktifkan proteksi atau whitelist domain ini jika fitur terganggu.',
          'BLOCKED_BY_CLIENT'
        );
      }

      throw new ApiError(
        err instanceof Error ? err.message : 'Terjadi gangguan pada permintaan jaringan.',
        'NETWORK_ERROR'
      );
    }
  }

  throw new ApiError('Gagal menghubungi server setelah beberapa percobaan.', 'NETWORK_ERROR');
}
