import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchApi, FetchApiOptions } from './api-client';

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

// In-Memory Stale-While-Revalidate Cache with LRU Eviction (Max 100 entries)
const MAX_CACHE_SIZE = 100;
const cache = new Map<string, CacheEntry<any>>();
const listeners = new Map<string, Set<(data: any) => void>>();

function setCacheEntry<T>(key: string, entry: CacheEntry<T>): void {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, entry);
}

// BroadcastChannel for instant cross-tab state synchronization
const syncChannel: BroadcastChannel | null =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('ams_cache_sync')
    : null;

// Domain correlation map for cross-dependent entity purging
const DOMAIN_EXPANSIONS: Record<string, string[]> = {
  agenda: ['/api/agenda', '/api/events', '/api/programs', '/api/activities', 'reports/top-presence', 'stats/top-presence'],
  events: ['/api/agenda', '/api/events', '/api/programs', '/api/activities', 'reports/top-presence', 'stats/top-presence'],
  members: ['/api/members', 'divisions', 'groups', 'stats/summary', 'stats/yearly', 'reports/yearly', 'recap/matrix'],
  attendance: ['/api/attendances', 'recap/matrix', 'stats/matrix', 'reports/top-presence', 'activity-tracker'],
  attendances: ['/api/attendances', 'recap/matrix', 'stats/matrix', 'reports/top-presence', 'activity-tracker'],
  qr: ['/api/qr', '/api/agenda', '/api/events', '/api/members'],
};

/**
 * Invalidates cached URLs matching a string prefix, tag, or RegExp.
 * Notifies all active component listeners, sends purge message to Service Worker,
 * and broadcasts to all other open tabs in real-time.
 */
export function invalidateCache(pattern?: string | RegExp, broadcast = true): void {
  if (!pattern) {
    cache.clear();
    listeners.forEach((set) => set.forEach((fn) => fn(null)));
  } else {
    // Collect all search terms including domain expansions
    const patternsToPurge: (string | RegExp)[] = [pattern];
    if (typeof pattern === 'string') {
      const cleanKey = pattern.replace(/^\/api\//, '').split(/[/?]/)[0].toLowerCase();
      if (DOMAIN_EXPANSIONS[cleanKey]) {
        patternsToPurge.push(...DOMAIN_EXPANSIONS[cleanKey]);
      }
    }

    for (const key of Array.from(cache.keys())) {
      const shouldInvalidate = patternsToPurge.some((p) =>
        typeof p === 'string'
          ? key.startsWith(p) || key.includes(p)
          : p.test(key)
      );

      if (shouldInvalidate) {
        cache.delete(key);
        const set = listeners.get(key);
        if (set) {
          set.forEach((fn) => fn(null));
        }
      }
    }
  }

  // Purge Service Worker CacheStorage
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'INVALIDATE_API_CACHE',
        pattern: typeof pattern === 'string' ? pattern : undefined,
      });
    } catch {
      // Safe fallback
    }
  }

  // Cross-tab broadcast
  if (broadcast && syncChannel) {
    try {
      syncChannel.postMessage({
        type: 'INVALIDATE_CACHE',
        pattern: typeof pattern === 'string' ? pattern : undefined,
      });
    } catch {
      // Safe fallback
    }
  }
}

// Listen to cross-tab invalidation broadcasts
if (syncChannel) {
  syncChannel.onmessage = (event) => {
    if (event.data && event.data.type === 'INVALIDATE_CACHE') {
      invalidateCache(event.data.pattern, false);
    }
  };
}

// Automatically listen to mutations from api-client.ts and invalidate cache
if (typeof window !== 'undefined') {
  window.addEventListener('ams:data-mutated', (e: Event) => {
    const customEvent = e as CustomEvent<{ url: string; method: string }>;
    if (customEvent.detail && customEvent.detail.url) {
      const url = customEvent.detail.url;
      if (url.includes('/guests') || url.includes('/qr')) {
        invalidateCache('agenda');
        invalidateCache('members');
        invalidateCache('/api/qr');
      } else if (url.includes('/agenda') || url.includes('/events') || url.includes('/programs') || url.includes('/activities')) {
        invalidateCache('agenda');
      } else if (url.includes('/members')) {
        invalidateCache('members');
        invalidateCache('agenda');
      } else if (url.includes('/attendances') || url.includes('/scan')) {
        invalidateCache('attendance');
      } else {
        invalidateCache(url);
      }
    }
  });
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

  if (cached) {
    // Refresh LRU recency
    cache.delete(url);
    cache.set(url, cached);
  }

  if (!forceRefresh && cached && now - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  // If stale cache exists, return it immediately and revalidate in background
  if (!forceRefresh && cached) {
    // Background revalidation
    fetchApi<T>(url, fetchOptions)
      .then((freshData) => {
        if (freshData !== null && freshData !== undefined) {
          setCacheEntry(url, { data: freshData, timestamp: Date.now() });
          const subscribers = listeners.get(url);
          if (subscribers) {
            subscribers.forEach((fn) => fn(freshData));
          }
        }
      })
      .catch(() => {
        // Silently swallow background revalidation error, keep using stale cache
      });

    return cached.data as T;
  }

  // Cold fetch
  const freshData = await fetchApi<T>(url, fetchOptions);
  if (freshData !== null && freshData !== undefined) {
    setCacheEntry(url, { data: freshData, timestamp: Date.now() });
    return freshData;
  }
  if (cached) {
    return cached.data as T;
  }
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
      if (isMounted.current) {
        if (freshData !== null) {
          setData(freshData as T);
        } else {
          // Automatic instant revalidation upon cache invalidation signal
          refetch(true);
        }
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
