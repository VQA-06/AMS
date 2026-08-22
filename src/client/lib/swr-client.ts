import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchApi, FetchApiOptions } from './api-client';

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

// In-Memory Stale-While-Revalidate Cache
const cache = new Map<string, CacheEntry<any>>();
const listeners = new Map<string, Set<(data: any) => void>>();

/**
 * Invalidates cached URLs matching a string prefix or RegExp.
 * Call this after write operations (POST, PUT, DELETE) to refresh data views.
 */
export function invalidateCache(pattern?: string | RegExp): void {
  if (!pattern) {
    cache.clear();
    listeners.forEach((set) => set.forEach((fn) => fn(null)));
    return;
  }

  for (const key of cache.keys()) {
    const shouldInvalidate =
      typeof pattern === 'string'
        ? key.startsWith(pattern) || key.includes(pattern)
        : pattern.test(key);

    if (shouldInvalidate) {
      cache.delete(key);
    }
  }
}

/**
 * Fetches data with In-Memory SWR (Stale-While-Revalidate) Cache
 * - Returns cached data in 0ms if available
 * - Silently revalidates in the background if data is older than ttlMs
 */
export async function fetchCached<T = unknown>(
  url: string,
  options?: FetchApiOptions & { ttlMs?: number; forceRefresh?: boolean }
): Promise<T> {
  const { ttlMs = 60_000, forceRefresh = false, ...fetchOptions } = options || {};
  const now = Date.now();
  const cached = cache.get(url);

  if (!forceRefresh && cached && now - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  // If stale cache exists, return it immediately and revalidate in background
  if (!forceRefresh && cached) {
    // Background revalidation
    fetchApi<T>(url, fetchOptions)
      .then((freshData) => {
        cache.set(url, { data: freshData, timestamp: Date.now() });
        const subscribers = listeners.get(url);
        if (subscribers) {
          subscribers.forEach((fn) => fn(freshData));
        }
      })
      .catch(() => {
        // Silently swallow background revalidation error, keep using stale cache
      });

    return cached.data as T;
  }

  // Cold fetch
  const freshData = await fetchApi<T>(url, fetchOptions);
  cache.set(url, { data: freshData, timestamp: Date.now() });
  return freshData;
}

/**
 * Enterprise React SWR Hook for Instant 0ms Visual Rendering
 */
export function useCachedQuery<T = unknown>(
  url: string | null,
  options?: { ttlMs?: number; enabled?: boolean }
) {
  const { ttlMs = 60_000, enabled = true } = options || {};
  const cachedEntry = url ? cache.get(url) : undefined;

  const [data, setData] = useState<T | null>(cachedEntry ? (cachedEntry.data as T) : null);
  const [loading, setLoading] = useState<boolean>(!cachedEntry && !!url && enabled);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const refetch = useCallback(
    async (force = true) => {
      if (!url || !enabled) return null;
      try {
        if (!cache.has(url)) {
          setLoading(true);
        }
        setError(null);
        const result = await fetchCached<T>(url, { ttlMs, forceRefresh: force });
        if (isMounted.current) {
          setData(result);
          setLoading(false);
        }
        return result;
      } catch (err) {
        if (isMounted.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
        return null;
      }
    },
    [url, enabled, ttlMs]
  );

  useEffect(() => {
    if (!url || !enabled) return;

    // Subscribe to cache background updates
    if (!listeners.has(url)) {
      listeners.set(url, new Set());
    }
    const updateHandler = (freshData: any) => {
      if (isMounted.current && freshData !== null) {
        setData(freshData as T);
      }
    };
    listeners.get(url)!.add(updateHandler);

    // Initial load
    refetch(false);

    return () => {
      const set = listeners.get(url);
      if (set) {
        set.delete(updateHandler);
        if (set.size === 0) {
          listeners.delete(url);
        }
      }
    };
  }, [url, enabled, refetch]);

  return { data, loading, error, refetch };
}
